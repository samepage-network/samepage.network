import { WebsiteStatusType, websiteStatuses } from "data/schema";
import getMysql from "./mysql.server";

const logWebsiteStatus = async ({
  websiteUuid,
  status,
  requestId,
  statusType = "DEPLOY",
}: {
  websiteUuid: string;
  status: string;
  requestId: string;
  statusType: WebsiteStatusType;
}) => {
  const cxn = await getMysql(requestId);
  await cxn.insert(websiteStatuses).values({
    websiteUuid,
    status,
    createdDate: new Date(),
    statusType,
  });
};

export default logWebsiteStatus;
