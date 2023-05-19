import getMysql from "~/data/mysql.server";
import { S3 } from "@aws-sdk/client-s3";
import { pageNotebookLinks, pages } from "data/schema";
import { eq } from "drizzle-orm/expressions";

const s3 = new S3({ region: "us-east-1", endpoint: process.env.AWS_ENDPOINT });

const deleteSharedPage = async (uuid: string, requestId: string) => {
  const cxn = await getMysql(requestId);
  await Promise.all([
    cxn.delete(pageNotebookLinks).where(eq(pageNotebookLinks.pageUuid, uuid)),
    s3.deleteObject({
      Bucket: "samepage.network",
      Key: `data/page/${uuid}.json`,
    }),
  ]);
  await cxn.delete(pages).where(eq(pages.uuid, uuid));
  await cxn.end();
  return { success: true };
};

export default deleteSharedPage;
