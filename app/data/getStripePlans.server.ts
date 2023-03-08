import Stripe from "stripe";

const getStripePlans = async () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2022-11-15",
  });
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
