import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { fromIni } from "@aws-sdk/credential-provider-ini";
import {
  notebooks,
  websiteNotebookLinks,
  websiteSharing,
  websites,
} from "../data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { v4 } from "uuid";
import getMysql from "../app/data/mysql.server";
import { handler as launchHandler } from "../api/launch";
import startWebsiteOperation from "../app/data/startWebsiteOperation.server";

const BLOCK_LIST = new Set(["roamjs-dvargas92495"]);

const run = async (requestId: string) => {
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

  const { StackSummaries = [] } = await roamjsCfn.listStacks({});
  const stackNames = StackSummaries.map((s) => s.StackName ?? "").filter(
    (s) => !BLOCK_LIST.has(s)
  );
  process.env.CLERK_SECRET_KEY = process.env.PRODUCTION_CLERK_SECRET_KEY;
  const { users } = await import("@clerk/clerk-sdk-node");
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
          const email = parameters["Email"];
          const customDomain = parameters["CustomDomain"] === "true";
          const domainName = parameters["DomainName"];
          const workspace = parameters["RoamGraph"];

          const usersFound = await users.getUserList({ emailAddress: [email] });

          return {
            StackName,
            email,
            customDomain,
            domainName,
            workspace,
            userId: usersFound[0]?.id,
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
        .then(() => console.log(`Launched ${s.website.graph}!`))
    )
  );
  return { stacks };
};

export default run;
