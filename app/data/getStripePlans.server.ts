import Stripe from "stripe";
import stripe from "./stripe.server";

const getStripePlans = async () => {
  const links = await stripe.paymentLinks.list({ expand: ["data.line_items"] });
  return Promise.all(
    links.data
      .map((link) => ({ link, price: link.line_items?.data?.[0]?.price }))
      .filter(
        (args): args is { price: Stripe.Price; link: Stripe.PaymentLink } =>
          !!args.price
      )
      .map(async ({ link, price }) => {
        return [
          await stripe.products
            .retrieve(price.product as string)
            .then((p) => p.name),
          link.url,
        ] as const;
      })
  ).then((entries) => Object.fromEntries(entries));
};

export default getStripePlans;
