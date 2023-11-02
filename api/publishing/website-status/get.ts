import {
  apps,
  notebooks,
  tokenNotebookLinks,
  tokens,
  websiteNotebookLinks,
  websiteSharing,
  websiteStatuses,
  websites,
} from "data/schema";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm/expressions";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";

type WebsiteStatus = {
  uuid: string;
  status: string;
  statusType: string;
  createdDate: Date;
};
const getProgressProps = (
  items: WebsiteStatus[],
  deployItems: WebsiteStatus[]
) => {
  if (!items) {
    return { progress: 0, progressType: "LAUNCHING" };
  }
  const launchIndex =
    items.findIndex((s) => s.status === "INITIALIZING") + 1 || Number.MAX_VALUE;
  const updateIndex =
    items.findIndex((s) => s.status === "UPDATING") + 1 || Number.MAX_VALUE;
  const shutdownIndex =
    items.findIndex((s) => s.status === "SHUTTING DOWN") + 1 ||
    Number.MAX_VALUE;
  const minIndex = Math.min(launchIndex, updateIndex, shutdownIndex);
  if (launchIndex === minIndex) {
    const deployIndex = deployItems.findIndex((s) =>
      ["SUCCESS", "FAILURE"].includes(s.status || "")
    );
    if (deployIndex) {
      return { progress: deployIndex / 5, progressType: "DEPLOYING" };
    }
    return { progress: launchIndex / 26, progressType: "LAUNCHING" };
  } else if (updateIndex === minIndex) {
    return { progress: updateIndex / 20, progressType: "UPDATING" };
  } else {
    return { progress: shutdownIndex / 18, progressType: "SHUTTING DOWN" };
  }
};

const bodySchema = z.object({ graph: z.string() });

const logic = async ({
  authorization,
  requestId,
  graph,
}: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(requestId);

  const userId = await authenticateRoamJSToken({
    authorization,
  });

  const userWebsites = await cxn
    .select({ websiteUuid: websiteSharing.websiteUuid })
    .from(websiteSharing)
    .where(
      and(
        eq(websiteSharing.permission, "DEPLOY"),
        eq(websiteSharing.userId, userId)
      )
    );

  if (!userWebsites.length) {
    return {
      authUser: {
        authenticated: true,
        websiteUuid: undefined,
      },
    };
  }

  const requestedWebsite = await cxn
    .select({ stackName: websites.stackName, uuid: websites.uuid })
    .from(websites)
    .innerJoin(
      websiteNotebookLinks,
      eq(websites.uuid, websiteNotebookLinks.websiteUuid)
    )
    .innerJoin(notebooks, eq(websiteNotebookLinks.notebookUuid, notebooks.uuid))
    .innerJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .innerJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .innerJoin(apps, eq(notebooks.app, apps.id))
    .where(
      and(
        eq(notebooks.workspace, graph),
        eq(tokens.userId, userId),
        eq(apps.name, "roam")
      )
    )
    .then((r) => r[0]);

  if (!requestedWebsite) {
    return {
      authUser: {
        authenticated: true,
        websiteUuid: undefined,
      },
    };
  }

  const statuses = await cxn
    .select({
      uuid: websiteStatuses.uuid,
      status: websiteStatuses.status,
      statusType: websiteStatuses.statusType,
      props: websiteStatuses.props,
      createdDate: websiteStatuses.createdDate,
    })
    .from(websiteStatuses)
    .where(eq(websiteStatuses.websiteUuid, requestedWebsite.uuid))
    .orderBy(desc(websiteStatuses.createdDate));

  if (!statuses.length) {
    return {};
  }

  const deployStatuses = statuses.filter((s) => s.statusType === "DEPLOY");
  const successDeployStatuses = statuses.filter((s) =>
    ["SUCCESS", "FAILURE"].includes(s.status)
  );
  const first = deployStatuses[0];
  const deploys =
    successDeployStatuses[0] === first
      ? successDeployStatuses
      : first
      ? [first, ...successDeployStatuses]
      : [];
  const status = statuses.length ? statuses[0].status : "INITIALIZING";

  return {
    graph,
    status,
    props: first.props,
    deploys: deploys.slice(0, 10).map((d) => ({
      date: d.createdDate,
      status: d.status,
      uuid: d.uuid,
    })),
    ...getProgressProps(statuses, deployStatuses),
  };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
