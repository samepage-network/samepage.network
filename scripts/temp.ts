import { S3 } from "@aws-sdk/client-s3";
import { notebooks, websiteNotebookLinks, websites } from "../data/schema";
import dotenv from "dotenv";
import { eq } from "drizzle-orm/expressions";
import { v4 } from "uuid";
import fs from "fs";
import getMysql from "../app/data/mysql.server";
import getCloudformationStackName from "../app/data/getCloudformationStackName.server";
dotenv.config();

const run = async () => {
  process.env.AWS_PROFILE = "roamjs";
  const s3 = new S3({});
  const response = await s3.listObjectsV2({
    Bucket: "roamjs-static-sites",
    Delimiter: "/",
  });
  const workspaces = (response.CommonPrefixes ?? [])
    .map((p) => p.Prefix ?? "")
    .map((p) => p.replace(/\/$/, ""));

  process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;

  const cxn = await getMysql();

  /**
   * This got blocked by needing to fix collated columns. Next time there's a planetscale migration needed, 
   * we should do it in a script like this. Here were the steps:
   * 
   * - Create a new branch
   * - Connect to branch
   * - SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, 
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = 'samepage_network' and COLLATION_NAME="utf8mb4_0900_ai_ci";
   * - For each column, run:
       ALTER TABLE <TABLE_NAME> MODIFY <COLUMN_NAME> <COLUMN_TYPE> CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   * - Create deploy request
   * - Deploy Changes
   * - No thanks, I won't need to revert
   * - Delete branch 
   */
  const roamNotebooks = await cxn
    .select({
      workspace: notebooks.workspace,
      uuid: notebooks.uuid,
      websiteUuid: websiteNotebookLinks.websiteUuid,
    })
    .from(notebooks)
    .leftJoin(
      websiteNotebookLinks,
      eq(notebooks.uuid, websiteNotebookLinks.notebookUuid)
    )
    .where(eq(notebooks.app, 1));
  const notebookByGraph = Object.fromEntries(
    roamNotebooks.map((n) => [n.workspace, n])
  );
  const roamNotebooksInS3 = workspaces.map((w) => ({
    uuid: notebookByGraph[w]?.uuid ?? v4(),
    workspace: w,
    websiteUuid: v4(),
    notebookExists: !!notebookByGraph[w],
  }));
  const newRoamNotebooksInS3 = roamNotebooksInS3.filter(
    (n) => !n.notebookExists
  );

  await cxn.insert(websites).values(
    ...roamNotebooksInS3.map((n) => ({
      uuid: n.websiteUuid,
      createdDate: new Date(),
      live: false,
      stackName: getCloudformationStackName(n.websiteUuid),
    }))
  );
  await cxn.insert(notebooks).values(
    ...newRoamNotebooksInS3.map((n) => ({
      uuid: n.uuid,
      workspace: n.workspace,
      label: n.workspace,
      app: 1,
    }))
  );
  await cxn.insert(websiteNotebookLinks).values(
    ...roamNotebooksInS3.map((n) => ({
      websiteUuid: n.websiteUuid,
      notebookUuid: n.uuid,
      uuid: v4(),
    }))
  );

  await cxn.end();
  return roamNotebooksInS3;
};

run().then((data) => {
  const filename = `/tmp/report-${v4()}.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`Report written to ${filename}`);
});
