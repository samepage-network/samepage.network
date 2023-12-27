import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { S3 } from "@aws-sdk/client-s3";
import { websites } from "data/schema";
import { eq } from "drizzle-orm/expressions";
import clearRecords from "~/data/clearRoute53Records.server";
import getMysql from "~/data/mysql.server";
import startWebsiteOperation from "~/data/startWebsiteOperation.server";

const s3 = new S3({});
const cf = new CloudFormation({});
const SHUTDOWN_CALLBACK_STATUS = "PREPARING TO DELETE STACK";

const emptyBucket = async (props: { Bucket: string; Prefix: string }) => {
  const { Contents = [], IsTruncated } = await s3.listObjects(props);
  if (Contents.length > 0) {
    await s3.deleteObjects({
      Bucket: props.Bucket,
      Delete: {
        Objects: Contents.map(({ Key }) => ({ Key })),
      },
    });
    if (IsTruncated) {
      await emptyBucket(props);
    }
  }
};

export const handler = async ({
  websiteUuid,
  authorization,
  requestId,
}: {
  websiteUuid: string;
  authorization: string;
  requestId: string;
}) => {
  const logStatus = await startWebsiteOperation({ websiteUuid, requestId, statusType: "LAUNCH" });

  const Bucket = `samepage.network`;
  const Prefix = `websites/${websiteUuid}/`;
  await logStatus("EMPTYING HOST");
  await emptyBucket({ Bucket, Prefix });

  await logStatus("DELETING RECORD");
  const cxn = await getMysql(requestId);
  const StackName = await cxn
    .select({ StackName: websites.stackName })
    .from(websites)
    .where(eq(websites.uuid, websiteUuid))
    .then(([{ StackName }]) => StackName);
  await clearRecords(StackName);

  await logStatus(SHUTDOWN_CALLBACK_STATUS, { authorization });

  await cf.deleteStack({
    StackName,
  });
  await cxn.end();

  return { success: true };
};
