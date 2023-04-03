import { User } from "@clerk/clerk-sdk-node";
import Stripe from "stripe";

const getStripePlan = (user: User) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2022-11-15",
  });
  const stripeCustomerId = user.privateMetadata.stripeCustomerId as string;
  return typeof stripeCustomerId === "string"
    ? stripe.subscriptions
        .list({
          customer: stripeCustomerId,
        })
        .then((s) =>
          s.data.length
            ? stripe.products
                .retrieve(s.data[0].items.data[0].price.product as string)
                .then((p) => p.name)
            : "Hobby"
        )
    : "Hobby";
};

export default getStripePlan;
