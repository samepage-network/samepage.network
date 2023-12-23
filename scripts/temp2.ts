import { S3 } from "@aws-sdk/client-s3";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { notebooks, websiteNotebookLinks, websites } from "../data/schema";
import dotenv from "dotenv";
import { eq } from "drizzle-orm/expressions";
import { v4 } from "uuid";
import fs from "fs";
import getMysql from "../app/data/mysql.server";
dotenv.config();

const run = async () => {
  process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
  const cxn = await getMysql();
  const roamNotebooks = await cxn
    .select({
      workspace: notebooks.workspace,
      websiteUuid: websiteNotebookLinks.websiteUuid,
    })
    .from(websites)
    .leftJoin(
      websiteNotebookLinks,
      eq(websites.uuid, websiteNotebookLinks.websiteUuid)
    )
    .leftJoin(notebooks, eq(notebooks.uuid, websiteNotebookLinks.notebookUuid))
    .where(eq(notebooks.app, 1));
  await cxn.end();

  const roamjsS3 = new S3({ credentials: fromIni({ profile: "roamjs" }) });
  const samepageS3 = new S3({ credentials: fromIni({ profile: "samepage" }) });

  const report = { migrated: [] as any[], roamNotebooks };
  for (const { workspace, websiteUuid } of roamNotebooks) {
    const Prefix = `${workspace}/`;
    const roamjsList = await roamjsS3.listObjectsV2({
      Bucket: "roamjs-static-sites",
      Prefix,
    });
    const files = roamjsList.Contents ?? [];
    console.log("Listed", files.length, "objects in", workspace, "website");

    let uploads = 0;
    for (const file of files) {
      const { Key } = file;
      if (!Key) {
        continue;
      }

      const object = await roamjsS3.getObject({
        Bucket: "roamjs-static-sites",
        Key,
      });
      const Body = await object.Body?.transformToString();
      try {
        await samepageS3.putObject({
          Bucket: "samepage.network",
          Key: `websites/${websiteUuid}/${Key.slice(Prefix.length)}`,
          Body,
          ContentType: object.ContentType,
        });
      } catch (exc) {
        return {
          ...report,
          error: {
            Key,
            ContentType: object.ContentType,
            Body,
            exc,
          },
        };
      }
      uploads++;
      if (uploads % 10 === 0) {
        console.log("Uploaded", uploads, "objects of", files.length, "...");
      }
    }

    console.log(
      "Uploaded",
      uploads,
      "objects of",
      files.length,
      "in",
      workspace,
      "website"
    );
    report.migrated.push({
      workspace,
      websiteUuid,
      uploads,
      total: files.length,
    });
  }

  return report;
};
run().then((data) => {
  const filename = `/tmp/report2-${v4()}.json`;
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log(`Report written to ${filename}`);
});
