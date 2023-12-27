import {
  WebsiteStatusType,
  websiteOperations,
  websiteStatuses,
} from "data/schema";
import getMysql from "./mysql.server";
import { Json } from "package/internal/types";
import { v4 } from "uuid";
import { and, desc, eq, isNull } from "drizzle-orm/expressions";

const logWebsiteStatus = async ({
  websiteUuid,
  status,
  requestId,
  statusType = "DEPLOY",
  props = {},
  operationUuid,
}: {
  websiteUuid: string;
  status: string;
  requestId: string;
  statusType: WebsiteStatusType;
  operationUuid?: string;
  props?: Record<string, Json>;
}) => {
  const cxn = await getMysql(requestId);

  const opUuid =
    operationUuid ??
    (await cxn
      .select({ uuid: websiteOperations.uuid })
      .from(websiteOperations)
      .where(
        and(
          eq(websiteOperations.websiteUuid, websiteUuid),
          isNull(websiteOperations.completedDate)
        )
      )
      .orderBy(desc(websiteOperations.createdDate))
      .then((op) => op[0]?.uuid));

  await cxn.insert(websiteStatuses).values({
    uuid: v4(),
    websiteUuid,
    operationUuid: opUuid,
    status,
    createdDate: new Date(),
    statusType,
    props,
  });
};

export default logWebsiteStatus;
