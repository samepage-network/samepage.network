import { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { AxiosRequestHeaders } from "axios";
import Stripe from "stripe";
import sendEmail from "package/backend/sendEmail.server";
import NewCustomerEmail from "~/components/NewCustomerEmail";
import SubscriptionUpdateEmail from "~/components/SubscriptionUpdateEmail";
import { users } from "@clerk/clerk-sdk-node";
import emailError from "package/backend/emailError.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  maxNetworkRetries: 3,
  apiVersion: "2022-11-15",
});

const normalizeHeaders = (
  hdrs: APIGatewayProxyEvent["headers"]
): AxiosRequestHeaders =>
  Object.fromEntries(
    Object.entries(hdrs)
      .map(([h, v]) => [h.toLowerCase(), v || ""])
      .filter(([, v]) => !!v)
  );

export const handler: APIGatewayProxyHandler = async (event) => {
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
      if (clerkUser && session.customer && oldCustomerId !== session.customer) {
        await users
          .updateUser(clerkUser.id, {
            privateMetadata: {
              ...clerkUser.privateMetadata,
              stripeCustomerId: session.customer,
            },
          })
          .then(() =>
            typeof oldCustomerId === "string"
              ? stripe.customers
                  .del(oldCustomerId)
                  .catch((e) =>
                    emailError(
                      "Failed to delete old customer upon subscription",
                      e
                    ).then(() => Promise.resolve())
                  )
              : Promise.resolve()
          );
      }
      await sendEmail({
        to: "support@samepage.network",
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
      await sendEmail({
        to: "support@samepage.network",
        subject: "SamePage Subscription Updated",
        body: SubscriptionUpdateEmail({
          email: customerEmail,
          status: subscription.status,
          id: subscription.id,
          feedback: subscription.cancellation_details?.feedback || undefined,
        }),
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {},
      };
    }
    default:
      return {
        statusCode: 400,
        body: `Unexpected type: ${type}`,
        headers: {},
      };
  }
};
