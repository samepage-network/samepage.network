import QUOTAS from "./quotas.server";
import getMysql from "fuegojs/utils/mysql";

export const globalContext: {
  quotas: { [k in typeof QUOTAS[number]]?: number };
} = {
  quotas: {},
};

const getQuota = async ({
  requestId,
  field,
}: {
  requestId: string;
  field: typeof QUOTAS[number];
}) => {
  const storedValue = globalContext.quotas[field];
  if (typeof storedValue !== "undefined") return storedValue;
  const cxn = await getMysql(requestId);
  return cxn
    .execute(`SELECT value FROM quotas WHERE field = ? AND stripe_id IS NULL`, [
      QUOTAS.indexOf(field),
    ])
    .then(([q]) => (q as { value: number }[])[0].value);
};

export default getQuota;
