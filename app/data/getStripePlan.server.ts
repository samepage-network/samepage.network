import { User } from "@clerk/clerk-sdk-node";
import stripe from "./stripe.server";

const getStripePlan = (user: User) => {
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
