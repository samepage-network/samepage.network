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
}: {
  websiteUuid: string;
  status: string;
  requestId: string;
  statusType: WebsiteStatusType;
  props?: Record<string, Json>
}) => {
  const cxn = await getMysql(requestId);
  await cxn.insert(websiteStatuses).values({
    uuid: v4(),
    websiteUuid,
    status,
    createdDate: new Date(),
    statusType,
    props,
  });
};

export default logWebsiteStatus;
