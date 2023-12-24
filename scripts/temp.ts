import getMysql from "../app/data/mysql.server";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import { AttributeValue, DynamoDB } from "@aws-sdk/client-dynamodb";
import {
  notebooks,
  websiteNotebookLinks,
  websiteRedirects,
  websiteStatuses,
  websites,
} from "../data/schema";
import { and, eq } from "drizzle-orm/expressions";

const run = async (requestId: string) => {
  const cxn = await getMysql(requestId);
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

  const scanAll = async (
    startKey?: Record<string, AttributeValue>
  ): Promise<{ Items: Record<string, AttributeValue>[]; Count: number }> => {
    const {
      Items = [],
      Count = 0,
      LastEvaluatedKey,
    } = await ddb.scan({
      TableName: "RoamJSWebsiteStatuses",
      ExclusiveStartKey: startKey,
    });
    if (LastEvaluatedKey) {
      const next = await scanAll(LastEvaluatedKey);
      return {
        Items: [...Items, ...next.Items],
        Count: next.Count + Count,
      };
    } else {
      return { Items, Count };
    }
  };
  const scan = await scanAll();
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

export default run;
