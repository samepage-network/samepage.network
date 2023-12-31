import { WebsiteStatusType, websiteOperations } from "../../data/schema";
import getMysql from "./mysql.server";
import { v4 } from "uuid";
import logWebsiteStatus from "./logWebsiteStatus.server";
import { Json } from "../../package/internal/types";

const startWebsiteOperation = async ({
  websiteUuid,
  requestId,
  statusType,
}: {
  websiteUuid: string;
  requestId: string;
  statusType: WebsiteStatusType;
}) => {
  const cxn = await getMysql(requestId);
  const operationUuid = v4();

  await cxn.insert(websiteOperations).values({
    websiteUuid,
    uuid: operationUuid,
    statusType,
    createdDate: new Date(),
  });

  const logStatus = (status: string, props?: Record<string, Json>) =>
    logWebsiteStatus({
      websiteUuid,
      status,
      requestId,
      statusType: "LAUNCH",
      operationUuid,
      props,
    });
  return logStatus;
};

export default startWebsiteOperation;
