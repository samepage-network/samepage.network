import { WebsiteStatusType, websiteStatuses } from "data/schema";
import getMysql from "./mysql.server";
import { Json } from "package/internal/types";
import { v4 } from "uuid";

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
  operationUuid: string;
  props?: Record<string, Json>;
}) => {
  const cxn = await getMysql(requestId);

  await cxn.insert(websiteStatuses).values({
    uuid: v4(),
    websiteUuid,
    operationUuid,
    status,
    createdDate: new Date(),
    statusType,
    props,
  });
};

export default logWebsiteStatus;
