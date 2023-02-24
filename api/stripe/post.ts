import { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { AxiosRequestHeaders } from "axios";
import Stripe from "stripe";
import sendEmail from "~/data/sendEmail.server";
import NewCustomerEmail from "~/components/NewCustomerEmail";

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
      await sendEmail({
        to: "vargas@samepage.network",
        subject: "New SamePage Customer",
        body: NewCustomerEmail({
          email: customerEmail,
        }),
      });
      return {
        statusCode: 204,
        body: "{}",
        headers: {},
      };
    }
    default:
      return {
        statusCode: 400,
        body: "",
        headers: {},
      };
  }
};
