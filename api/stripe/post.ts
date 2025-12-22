import { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { AxiosRequestHeaders } from "axios";
import Stripe from "stripe";
import sendEmail from "package/backend/sendEmail.server";
import NewCustomerEmail from "~/components/NewCustomerEmail";
import SubscriptionUpdateEmail from "~/components/SubscriptionUpdateEmail";
import { users } from "@clerk/clerk-sdk-node";
import emailError from "package/backend/emailError.server";
import randomString from "~/data/randomString.server";
import WelcomeClientEmail from "~/components/WelcomeClientEmail";
import { sheets } from "@googleapis/sheets";
import { GoogleAuth } from "googleapis-common";
import type { CredentialBody } from "google-auth-library/build/src/auth/credentials";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  maxNetworkRetries: 3,
  apiVersion: "2022-11-15",
});

const toSheetsDate = (date: Date) => {
  const ms = date.valueOf();
  const msInDay = 24 * 60 * 60 * 1000;
  const days = ms / msInDay;
  const googleSheetsEpochOffset = 25569;
  return days + googleSheetsEpochOffset;
};

const recordTransaction = async (
  bt: Stripe.BalanceTransaction | string | null
) => {
  if (typeof bt !== "string")
    throw new Error(`No string balance transaction found`);

  const tx = await stripe.balanceTransactions.retrieve(bt);
  const record = {
    Date: new Date(tx.created * 1000),
    Source: "Stripe",
    Description: tx.description || "No description",
    Amount: tx.net / 100,
    Code:
      tx.type === "adjustment"
        ? 1001
        : tx.type === "payout"
        ? 3000
        : tx.type === "stripe_fee"
        ? 2200
        : tx.type === "charge"
        ? 1000
        : 9999,
    ID: tx.id,
  };
  // TODO - replace with Accessing API via SamePage
  const [adminUser] = await users.getUserList({
    emailAddress: ["vargas@samepage.network"],
  });
  if (!adminUser) throw new Error(`No admin user found`);
  const {
    google: { privateKeyFile, spreadsheetId },
  } = adminUser.privateMetadata as {
    google: {
      privateKeyFile: CredentialBody;
      spreadsheetId: string;
    };
  };
  const auth = new GoogleAuth({
    credentials: privateKeyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = sheets({ version: "v4", auth });
  const out = await client.spreadsheets.get({
    spreadsheetId,
    ranges: [`'Transactions'!A1:F1`],
    includeGridData: true,
  });
  const sheet = out.data.sheets?.[0];
  if (!sheet) throw new Error(`No sheet found`);
  const header = sheet.data?.[0]?.rowData?.[0];
  if (!header) throw new Error(`No header found`);
  const values = (header.values || []).map((v) => {
    const key = v.userEnteredValue?.stringValue;
    if (!key) return null;
    if (!(key in record)) return null;
    return record[key as keyof typeof record];
  });
  if (values.some((v) => v === null)) throw new Error(`Missing values`);

  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          appendCells: {
            sheetId: sheet.properties?.sheetId,
            rows: [
              {
                values: (values as (string | number | Date)[]).map((value) => {
                  return {
                    userEnteredValue:
                      typeof value === "string"
                        ? {
                            stringValue: value,
                          }
                        : value instanceof Date
                        ? {
                            numberValue: toSheetsDate(value),
                          }
                        : {
                            numberValue: value,
                          },
                  };
                }),
              },
            ],
            fields: "userEnteredValue",
          },
        },
      ],
    },
  });

  await sendEmail({
    to: "mclicks+samepage@gmail.com",
    subject: "SamePage Transaction Recorded",
    body: `You can verify the transaction at ${out.data.spreadsheetUrl}`,
  });
};

const normalizeHeaders = (
  hdrs: APIGatewayProxyEvent["headers"]
): AxiosRequestHeaders =>
  Object.fromEntries(
    Object.entries(hdrs)
      .map(([h, v]) => [h.toLowerCase(), v || ""])
      .filter(([, v]) => !!v)
  );

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const headers = normalizeHeaders(event.headers);
    const { ["stripe-signature"]: sig } = headers;
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body || "{}",
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
    const {
      type,
      data: { object },
    } = stripeEvent;
    switch (type) {
      case "checkout.session.completed": {
        const session = object as Stripe.Checkout.Session;
        const customerEmail = await stripe.customers
          .retrieve(session.customer as string)
          .then((customer) =>
            customer.deleted ? "DELETED" : customer.email || "UNKNOWN"
          )
          .catch(() => "ERROR");
        const [clerkUser] = await users.getUserList({
          emailAddress: [customerEmail],
        });
        const oldCustomerId = clerkUser?.privateMetadata.stripeCustomerId;
        if (
          clerkUser &&
          session.customer &&
          oldCustomerId !== session.customer
        ) {
          await users.updateUser(clerkUser.id, {
            privateMetadata: {
              ...clerkUser.privateMetadata,
              stripeCustomerId: session.customer,
            },
          });
          if (typeof oldCustomerId === "string") {
            const subs = await stripe.subscriptions.list({
              customer: oldCustomerId,
            });
            if (subs.data.length > 0) {
              await emailError(
                "Couldn't delete old customer due to preexisting subscriptions",
                new Error(
                  `Old customer: https://dashboard.stripe.com/customers/${oldCustomerId}`
                )
              );
            } else {
              await stripe.customers
                .del(oldCustomerId)
                .catch((e) =>
                  emailError(
                    "Failed to delete old customer upon subscription",
                    e
                  )
                );
            }
          }
        }
        const temporaryPassword = !clerkUser
          ? await randomString({ length: 12, encoding: "base64" }).then((pw) =>
              users
                .createUser({
                  emailAddress: [customerEmail],
                  password: pw,
                })
                .then(() => pw)
            )
          : "";
        const productName = await stripe.invoices
          .retrieve(session.invoice as string, {
            expand: ["lines.data.price.product"],
          })
          .then(
            (invoice) =>
              (invoice.lines.data[0].price?.product as Stripe.Product).name
          );
        if (productName === "Client")
          await sendEmail({
            to: customerEmail,
            subject: "Welcome to SamePage!",
            body: WelcomeClientEmail({ temporaryPassword }),
          });
        await sendEmail({
          to: "mclicks+samepage@gmail.com",
          subject: "New SamePage Customer",
          body: NewCustomerEmail({
            email: customerEmail,
          }),
        });
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true }),
          headers: {},
        };
      }
      case "customer.subscription.updated": {
        const subscription = object as Stripe.Subscription;
        const customerEmail = await stripe.customers
          .retrieve(subscription.customer as string)
          .then((customer) =>
            customer.deleted ? "DELETED" : customer.email || "UNKNOWN"
          )
          .catch(() => "ERROR");
        if (subscription.status !== "active")
          await sendEmail({
            to: "mclicks+samepage@gmail.com",
            subject: "SamePage Subscription Updated",
            body: SubscriptionUpdateEmail({
              email: customerEmail,
              status: subscription.status,
              id: subscription.id,
              feedback:
                subscription.cancellation_details?.feedback || undefined,
            }),
          });
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true }),
          headers: {},
        };
      }
      case "payout.paid": {
        const payout = object as Stripe.Payout;
        await recordTransaction(payout.balance_transaction);
        const recentTransactions = await stripe.balanceTransactions.list({
          limit: 4,
        });
        await Promise.all([
          recentTransactions.data
            .filter(
              (tx) => tx.type === "stripe_fee" || tx.type === "adjustment"
            )
            .map((tx) => recordTransaction(tx.id)),
        ]);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true }),
          headers: {},
        };
      }
      case "charge.succeeded": {
        const charge = object as Stripe.Charge;
        await recordTransaction(charge.balance_transaction);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true }),
          headers: {},
        };
        // case "balance transaction"
        // https://dashboard.stripe.com/balance
      }
      default:
        return {
          statusCode: 400,
          body: `Unexpected type: ${type}`,
          headers: {},
        };
    }
  } catch (e) {
    await emailError("Failed to process Stripe event", e as Error);
    return {
      statusCode: 500,
      body: `Unexpected Error: ${(e as Error).message}`,
      headers: {},
    };
  }
};
