import QUOTAS from "./quotas.server";
import getMysql from "~/data/mysql.server";
import { users } from "@clerk/clerk-sdk-node";
import { quotas, tokens } from "data/schema";
import { eq, and, isNull } from "drizzle-orm/expressions";
import { getPrimaryEmailFromUser } from "./getPrimaryUserEmail.server";
import stripe from "./stripe.server";

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
    .then(([r]) => r.user_id);
  const user = await users.getUser(userId).catch(() => null);
  if (user && getPrimaryEmailFromUser(user)?.endsWith("@samepage.network"))
    return Number.MAX_VALUE;
  const customer = user?.privateMetadata?.stripeCustomerId as string;
  const stripeId = customer
    ? await stripe.subscriptions
        .list({
          customer,
        })
        .then((subs) =>
          subs.data.length ? subs.data[0].items.data[0].price.id : ""
        )
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
      if (!q) return Number.MAX_VALUE;
      const { value } = q;
      if (quotasInThisPlan) quotasInThisPlan[field] = value;
      else context.quotas[stripeId] = { [field]: value };
      return value;
    });
};

export default getQuota;
