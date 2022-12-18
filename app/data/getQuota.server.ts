import QUOTAS from "./quotas.server";
import getMysql from "fuegojs/utils/mysql";
import { users } from "@clerk/clerk-sdk-node";
import Stripe from "stripe";

export const globalContext: {
  quotas: { [p: string]: { [k in typeof QUOTAS[number]]?: number } };
} = {
  quotas: {},
};

const getQuota = async ({
  requestId,
  field,
  tokenUuid,
}: {
  requestId: string;
  field: typeof QUOTAS[number];
  tokenUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  console.log("globalContext", JSON.stringify(globalContext));
  const userId = await cxn
    .execute(`SELECT user_id FROM tokens WHERE uuid = ?`, [tokenUuid])
    .then(([r]) => (r as { user_id: string }[])[0]?.user_id);
  console.log("userId", JSON.stringify(userId));
  const stripeId = userId
    ? await users
        .getUser(userId)
        .then((u) => {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
            apiVersion: "2022-11-15",
          });
          return stripe.subscriptions.list({
            customer: u.privateMetadata.stripeCustomerId as string,
          });
        })
        .then((subs) => subs.data[0].items.data[0].price.id)
        .catch((e) => {
          console.error(e);
          return "";
        })
    : "";
  console.log("stripeId", JSON.stringify(stripeId));
  const quotasInThisPlan = globalContext.quotas[stripeId];
  console.log("quotasInThisPlan", JSON.stringify(quotasInThisPlan));
  const storedValue = quotasInThisPlan?.[field];
  console.log("storedValue", JSON.stringify(storedValue || "NULL"));
  if (typeof storedValue !== "undefined") return storedValue;
  return cxn
    .execute(
      `SELECT value FROM quotas WHERE field = ? AND stripe_id ${
        stripeId ? "= ?" : "IS NULL"
      }`,
      ([QUOTAS.indexOf(field)] as (string | number)[]).concat(
        stripeId ? [stripeId] : []
      )
    )
    .then(([q]) => {
      const { value } = (q as { value: number }[])[0];
      if (quotasInThisPlan) quotasInThisPlan[field] = value;
      else globalContext.quotas[stripeId] = { [field]: value };
      return value;
    });
};

export default getQuota;
