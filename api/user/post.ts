import { users } from "@clerk/clerk-sdk-node";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Webhook } from "svix";
import emailError from "~/data/emailError.server";
import Stripe from "stripe";
import sendEmail from "~/data/sendEmail.server";
import WelcomeEmail from "~/components/WelcomeEmail";
import NewUserEmail from "~/components/NewUserEmail";
import { subscribe } from "~/data/subscribeToConvertkitAction.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
  maxNetworkRetries: 3,
});

const wh = new Webhook(process.env.SVIX_SECRET);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> =>
  Promise.resolve()
    .then(() => {
      if (!event.body) return { statusCode: 400, body: "Body is empty" };
      const svixId = event.headers["svix-id"] || event.headers["Svix-Id"];
      if (!svixId) return { statusCode: 400, body: "svix-id is missing" };
      const svixSignature =
        event.headers["svix-signature"] || event.headers["Svix-Signature"];
      if (!svixSignature)
        return { statusCode: 400, body: "svix-signature is missing" };
      const svixTimestamp =
        event.headers["svix-timestamp"] || event.headers["Svix-Timestamp"];
      if (!svixTimestamp)
        return { statusCode: 400, body: "svix-timestamp is missing" };
      const payload = wh.verify(event.body, {
        "svix-id": svixId,
        "svix-signature": svixSignature,
        "svix-timestamp": svixTimestamp,
      }) as { data?: Record<string, string>; type?: string };
      if (payload.type !== "user.created") {
        return {
          statusCode: 400,
          body: "Only user.created events are accepted",
        };
      }
      if (!payload.data) {
        return { statusCode: 400, body: "payload data is missing" };
      }
      const data = payload.data;
      const {
        id,
        first_name,
        last_name,
        email_addresses,
        primary_email_address_id,
      } = data;
      // @ts-ignore
      const email = email_addresses.find(
        (e: { id: string }) => e.id === primary_email_address_id
      ).email_address;
      return stripe.customers
        .list({
          email,
        })
        .then((existingCustomers) =>
          existingCustomers.data.length
            ? Promise.resolve(existingCustomers.data[0])
            : stripe.customers.create({
                email,
                name:
                  first_name && last_name
                    ? `${first_name} ${last_name}`
                    : first_name || last_name || "",
              })
        )
        .then((r) =>
          subscribe({ email, tag: "SignUp", form: "AutoConfirm" })
            .then((sub) => ({
              stripeCustomerId: r.id,
              convertKit: sub.success ? sub.data : undefined,
            }))
            .catch((e) => {
              emailError("Failed to subscribe customer to ConvertKit", e);
              return {
                stripeCustomerId: r.id,
              };
            })
        )
        .then((privateMetadata) =>
          users.updateUser(id, {
            privateMetadata,
          })
        )
        .then(() =>
          Promise.all([
            sendEmail({
              to: email,
              subject: "Welcome to SamePage!",
              body: WelcomeEmail(),
            }),
            sendEmail({
              to: "vargas@samepage.network",
              subject: "New SamePage User",
              body: NewUserEmail({ email }),
            }),
          ])
        )
        .then(() => ({
          statusCode: 200,
          body: JSON.stringify({ success: true }),
        }));
    })
    .catch((e) =>
      emailError("Customer Creation Webhook Failed", e).then((id) => ({
        statusCode: 500,
        body: `Server Error: ${id}`,
      }))
    );
