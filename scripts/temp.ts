import dotenv from "dotenv";
import { v4 } from "uuid";
import fs from "fs";
import getMysql from "../app/data/mysql.server";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { MySql2Database } from "drizzle-orm/mysql2";
import { AttributeValue, DynamoDB } from "@aws-sdk/client-dynamodb";
import {
  notebooks,
  websiteNotebookLinks,
  websiteRedirects,
  websiteStatuses,
  websites,
} from "../data/schema";
import { and, eq } from "drizzle-orm/expressions";
dotenv.config();

const run = async (cxn: MySql2Database) => {
  const websiteUuidsByGraph = await cxn
    .select({ uuid: websites.uuid, graph: notebooks.workspace })
    .from(websites)
    .innerJoin(
      websiteNotebookLinks,
      eq(websiteNotebookLinks.websiteUuid, websites.uuid)
    )
    .innerJoin(notebooks, eq(notebooks.uuid, websiteNotebookLinks.notebookUuid))
    .where(and(eq(notebooks.app, 1)))
    .then((rows) => Object.fromEntries(rows.map((r) => [r.graph, r.uuid])));

  const ddb = new DynamoDB({ credentials: fromIni({ profile: "roamjs" }) });
  const scan = await ddb.scan({ TableName: "RoamJSWebsiteStatuses" });
  const missingItems = [] as Record<string, AttributeValue>[];
  console.log("There are", scan.Count, "items to migrate.");

  let processed = 0;
  let alreadyProcessed = 0;
  for (const item of scan.Items ?? []) {
    processed++;
    if (processed % 20 === 0) {
      console.log("Processed", processed, "items.");
    }

    if (item.processed?.BOOL) {
      alreadyProcessed++;
      continue;
    }

    const upd = () =>
      ddb.updateItem({
        TableName: "RoamJSWebsiteStatuses",
        Key: {
          uuid: { S: item.uuid?.S ?? "" },
          date: { S: item.date?.S ?? "" },
        },
        UpdateExpression: "SET #processed = :processed",
        ExpressionAttributeNames: {
          "#processed": "processed",
        },
        ExpressionAttributeValues: {
          ":processed": { BOOL: true },
        },
      });

    if (item.action_graph?.S?.startsWith("deploy_")) {
      const [_action, graph] = item.action_graph.S.split("_");
      const websiteUuid = websiteUuidsByGraph[graph];

      await cxn.insert(websiteStatuses).values({
        uuid: item.uuid?.S,
        statusType: "DEPLOY",
        status: item.status?.S,
        createdDate: item.date?.S ? new Date(item.date.S) : new Date(),
        websiteUuid,
        props: item.status_props?.S ? JSON.parse(item.status_props.S) : {},
      });

      await upd();
      continue;
    }

    if (item.action_graph?.S?.startsWith("launch_")) {
      const [_action, graph] = item.action_graph.S.split("_");
      const websiteUuid = websiteUuidsByGraph[graph];

      await cxn.insert(websiteStatuses).values({
        uuid: item.uuid?.S,
        statusType: "LAUNCH",
        status: item.status?.S,
        createdDate: item.date?.S ? new Date(item.date.S) : new Date(),
        websiteUuid,
        props: item.status_props?.S ? JSON.parse(item.status_props.S) : {},
      });

      await upd();
      continue;
    }

    if (item.action_graph?.S?.startsWith("redirect_")) {
      const [_action, graph] = item.action_graph.S.split("_");
      const websiteUuid = websiteUuidsByGraph[graph];

      await cxn.insert(websiteRedirects).values({
        uuid: item.uuid?.S,
        createdDate: item.date?.S ? new Date(item.date.S) : new Date(),
        websiteUuid,
        from: item.status?.S,
        to: item.status_props?.S,
      });

      await upd();
      continue;
    }

    missingItems.push(item);
  }

  console.log(missingItems.length, "missing items");
  return {
    processed,
    alreadyProcessed,
    missing: missingItems.length,
    total: scan.Count,
    missingExamples: missingItems.slice(0, 10),
    websiteUuidsByGraph,
  };
};

process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
getMysql().then((cxn) =>
  run(cxn)
    .then((data) => {
      const filename = `/tmp/report-${v4()}.json`;
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`Report written to ${filename}`);
    })
    .catch((e) => {
      console.error("Error running migration:");
      console.error(e);
    })
    .finally(() => cxn.end())
);
