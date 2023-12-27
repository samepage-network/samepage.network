import { websiteOperations } from "data/schema";
import getMysql from "./mysql.server";
import { and, desc, eq, isNull } from "drizzle-orm/expressions";

const getLatestOperation = async ({
  websiteUuid,
  requestId,
}: {
  websiteUuid: string;
  requestId: string;
}) => {
  const cxn = await getMysql(requestId);
  return cxn
    .select({ uuid: websiteOperations.uuid })
    .from(websiteOperations)
    .where(
      and(
        eq(websiteOperations.websiteUuid, websiteUuid),
        isNull(websiteOperations.completedDate)
      )
    )
    .orderBy(desc(websiteOperations.createdDate))
    .then((op) => op[0]);
};

export default getLatestOperation;
