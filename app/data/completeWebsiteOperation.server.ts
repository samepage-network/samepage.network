import { websiteOperations } from "data/schema";
import getMysql from "./mysql.server";
import { eq } from "drizzle-orm";

const completeWebsiteOperation = async ({
  operationUuid,
  requestId,
}: {
  operationUuid: string;
  requestId: string;
}) => {
  const cxn = await getMysql(requestId);
  await cxn
    .update(websiteOperations)
    .set({
      completedDate: new Date(),
    })
    .where(eq(websiteOperations.uuid, operationUuid));
};

export default completeWebsiteOperation;
