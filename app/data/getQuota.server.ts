import QUOTAS from "./quotas.server";
import getMysql from "~/data/mysql.server";
import { users } from "@clerk/clerk-sdk-node";
import Stripe from "stripe";
import { quotas, tokens } from "data/schema";
import { eq, and, isNull } from "drizzle-orm/expressions";

type BackendContext = {
  quotas: { [p: string]: { [k in (typeof QUOTAS)[number]]?: number } };
};

export const globalContext: Record<string, BackendContext> = {};

const getBackendContext = (requestId: string): BackendContext =>
  globalContext[requestId] || (globalContext[requestId] = { quotas: {} });

const getQuota = async ({
  requestId,
  field,
  tokenUuid,
}: {
  requestId: string;
  field: (typeof QUOTAS)[number];
  tokenUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const userId = await cxn
    .select({ user_id: tokens.userId })
    .from(tokens)
    .where(eq(tokens.uuid, tokenUuid))
    .then(([r]) => r?.user_id);
  const stripeId = userId
    ? await users
        .getUser(userId)
        .then((u) => {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
            apiVersion: "2022-11-15",
          });
          const customer = u.privateMetadata.stripeCustomerId as string;
          return customer
            ? stripe.subscriptions
                .list({
                  customer,
                })
                .then((subs) => subs.data[0].items.data[0].price.id)
            : "";
        })
        .catch(() => {
          return "";
        })
    : "";
  const context = getBackendContext(requestId);
  const quotasInThisPlan = context.quotas[stripeId];
  const storedValue = quotasInThisPlan?.[field];
  if (typeof storedValue !== "undefined") return storedValue;
  return cxn
    .select({ value: quotas.value })
    .from(quotas)
    .where(
      and(
        eq(quotas.field, QUOTAS.indexOf(field)),
        stripeId ? eq(quotas.stripeId, stripeId) : isNull(quotas.stripeId)
      )
    )
    .then(([q]) => {
      const { value } = q;
      if (quotasInThisPlan) quotasInThisPlan[field] = value;
      else context.quotas[stripeId] = { [field]: value };
      return value;
    });
};

export default getQuota;
