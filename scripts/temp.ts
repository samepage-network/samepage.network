import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import {
  notebooks,
  websiteNotebookLinks,
  websiteOperations,
  websiteSharing,
  websiteStatuses,
  websites,
} from "../data/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm/expressions";
import { v4 } from "uuid";
import getMysql from "../app/data/mysql.server";
import { handler as launchHandler } from "../api/launch";
import startWebsiteOperation from "../app/data/startWebsiteOperation.server";
// import fs from "fs";

const ALLOW_LIST = new Set(["roamjs-DiH"]);
// const hardcoded: Record<string, string> = JSON.parse(
//   fs.readFileSync("./scripts/data.json", "utf8").toString()
// );

const migrateCf = async (requestId: string) => {
  const cxn = await getMysql(requestId);
  const websiteByGraph = await cxn
    .select({
      uuid: websites.uuid,
      graph: notebooks.workspace,
      date: websites.createdDate,
      shared: websiteSharing.uuid,
    })
    .from(websites)
    .innerJoin(
      websiteNotebookLinks,
      eq(websiteNotebookLinks.websiteUuid, websites.uuid)
    )
    .innerJoin(notebooks, eq(notebooks.uuid, websiteNotebookLinks.notebookUuid))
    .leftJoin(websiteSharing, eq(websiteSharing.websiteUuid, websites.uuid))
    .where(and(eq(notebooks.app, 1)))
    .then((rows) => Object.fromEntries(rows.map((r) => [r.graph, r])));

  const roamjsCfn = new CloudFormation({
    credentials: fromIni({ profile: "roamjs" }),
  });

  const { StackSummaries = [] } = await roamjsCfn.listStacks({
    StackStatusFilter: ["CREATE_COMPLETE", "UPDATE_COMPLETE"],
  });
  const stackNames = StackSummaries.map((s) => s.StackName ?? "").filter((s) =>
    ALLOW_LIST.has(s)
  );
  console.log("Found", stackNames.length, "old stacks");

  const stacks = await Promise.all(
    stackNames.map((StackName) =>
      roamjsCfn
        .describeStacks({
          StackName,
        })
        .then(async ({ Stacks = [] }) => {
          const parameters = Object.fromEntries(
            Stacks[0].Parameters?.map((p) => [
              p.ParameterKey ?? "",
              p.ParameterValue ?? "",
            ]) ?? []
          );
          const email = "vargas@samepage.network";
          const customDomain = parameters["CustomDomain"] === "true";
          const domainName = parameters["DomainName"];
          const workspace = parameters["RoamGraph"];

          const userId = "user_lookup_here";
          if (!userId) {
            console.log("No user found for", email, "domain", domainName);
            throw new Error("No user found");
          }

          return {
            StackName,
            email,
            customDomain,
            domainName,
            workspace,
            userId,
            website: websiteByGraph[workspace],
          };
        })
    )
  );
  console.log("Gathered", stacks.length, "stacks");

  const stacksToShare = stacks.filter((s) => !s.website.shared);
  if (stacksToShare.length > 0) {
    await cxn.insert(websiteSharing).values(
      ...stacksToShare.map((s) => ({
        permission: "DEPLOY" as const,
        userId: s.userId,
        websiteUuid: s.website.uuid,
        createdDate: s.website.date,
        uuid: v4(),
      }))
    );
  }
  console.log("Updated", stacksToShare.length, "stacks to share");

  process.env.NODE_ENV = "test";
  await Promise.all(
    stacks.map((s) =>
      startWebsiteOperation({
        websiteUuid: s.website.uuid,
        requestId,
        statusType: "LAUNCH",
      })
        .then(() =>
          // @ts-ignore
          launchHandler({
            websiteUuid: s.website.uuid,
            userId: s.userId,
            requestId,
            domain: s.domainName,
          })
        )
        .then(({ success }) =>
          console.log(`Launched ${s.website.graph} - ${success}!`)
        )
    )
  );
  return { stacks };
};

const migrateOperations = async (requestId: string) => {
  const cxn = await getMysql(requestId);
  const statuses = await cxn
    .select({
      uuid: websiteStatuses.uuid,
      status: websiteStatuses.status,
      createdDate: websiteStatuses.createdDate,
      statusType: websiteStatuses.statusType,
      websiteUuid: websiteStatuses.websiteUuid,
    })
    .from(websiteStatuses)
    .where(isNull(websiteStatuses.operationUuid))
    .orderBy(desc(websiteStatuses.createdDate));

  const operations: {
    statuses: typeof statuses;
    uuid: string;
    websiteUuid: string;
    statusType: "LAUNCH" | "DEPLOY";
  }[] = [];
  statuses.forEach((s) => {
    if (s.statusType === "LAUNCH" && s.status === "LIVE") {
      operations.push({
        statuses: [s],
        uuid: v4(),
        statusType: "LAUNCH",
        websiteUuid: s.websiteUuid,
      });
    } else if (s.statusType === "LAUNCH" && s.status === "FAILURE") {
      operations.push({
        statuses: [s],
        uuid: v4(),
        statusType: "LAUNCH",
        websiteUuid: s.websiteUuid,
      });
    } else if (s.statusType === "DEPLOY" && s.status === "SUCCESS") {
      operations.push({
        statuses: [s],
        uuid: v4(),
        statusType: "DEPLOY",
        websiteUuid: s.websiteUuid,
      });
    } else if (s.statusType === "DEPLOY" && s.status === "FAILURE") {
      operations.push({
        statuses: [s],
        uuid: v4(),
        statusType: "DEPLOY",
        websiteUuid: s.websiteUuid,
      });
    } else {
      const statusFilters = operations.filter(
        (o) => o.statusType == s.statusType
      );
      const last = statusFilters[statusFilters.length - 1];
      if (last) {
        last.statuses.push(s);
      }
    }
  });
  console.log("Creating", operations.length, "operations");
  const failedOperations: unknown[] = [];
  await operations
    .map((o, i) => async () => {
      if (!o.websiteUuid) {
        failedOperations.push({ operation: o, reason: "No websiteUuid" });
        console.log("Failed operation", i);
        return;
      }
      const insert = {
        websiteUuid: o.websiteUuid,
        uuid: o.uuid,
        completedDate: o.statuses[0].createdDate,
        createdDate: o.statuses[o.statuses.length - 1].createdDate,
        statusType: o.statusType,
      };
      await cxn.insert(websiteOperations).values(insert);
      await cxn
        .update(websiteStatuses)
        .set({ operationUuid: o.uuid })
        .where(
          inArray(
            websiteStatuses.uuid,
            o.statuses.map((s) => s.uuid)
          )
        );
      console.log("Inserted operation", i);
    })
    .reduce((p, f) => p.then(f), Promise.resolve());
  return { operations, failedOperations };
};

const run = async (requestId: string) => {
  console.log(typeof migrateCf, typeof migrateOperations);
  return migrateOperations(requestId);
};

export default run;
