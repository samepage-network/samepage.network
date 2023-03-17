import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

const loadMRRAnalytics = async () => {
  const subs = await stripe.subscriptions.list({ status: "all" });
  let total = 0;
  const data = subs.data
    .flatMap((s) => {
      const mrr = (s.items.data[0].price.unit_amount || 0) / 100;
      return [
        {
          date: new Date(s.created * 1000).valueOf(),
          delta: mrr,
        },
      ].concat(
        s.canceled_at
          ? [
              {
                date: new Date(s.canceled_at * 1000).valueOf(),
                delta: -mrr,
              },
            ]
          : []
      );
    })
    .sort((a, b) => a.date - b.date)
    .map((d) => {
      return {
        mrr: (total += d.delta),
        date: d.date,
      };
    })
    .concat([{ mrr: total, date: new Date().valueOf() }]);
  return { data };
};

export default loadMRRAnalytics;
