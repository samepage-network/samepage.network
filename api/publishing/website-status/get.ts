import { websiteSharing, websites } from "data/schema";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm/expressions";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import authenticateRoamJSGraph from "~/data/authenticateRoamJSToken.server";
import { ForbiddenError } from "~/data/errors.server";

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

  const { notebookUuid, token } = await authenticateRoamJSGraph({
    requestId,
    authorization,
  });

  const { userId } = await authenticateNotebook({
    requestId,
    token,
    notebookUuid,
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

  // TODO: getWebsiteUuidByWorkspace
  const requestedWebsiteUuid = graph;
  const requestedWebsite = await cxn
    .select({ stackName: websites.stackName })
    .from(websites)
    .where(eq(websites.uuid, requestedWebsiteUuid))
    .then((r) => r[0]);

  if (!requestedWebsite) {
    return {
      authUser: {
        authenticated: true,
        websiteUuid: undefined,
      },
    };
  }

  if (!userWebsites.some((w) => w.websiteUuid === requestedWebsiteUuid)) {
    throw new ForbiddenError(
      `User not authorized to get status of website from graph ${graph}.`
    );
  }

  // TODO: make table
  const websiteStatuses = websiteSharing;
  const statuses = await cxn
    .select({
      uuid: websiteStatuses.uuid,
      status: websiteStatuses.permission,
      statusType: websiteStatuses.permission,
      createdDate: websiteStatuses.createdDate,
    })
    .from(websiteStatuses)
    .where(eq(websiteStatuses.websiteUuid, requestedWebsiteUuid))
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
    // statusProps: statuses.Items ? statuses.Items[0].status_props?.S : "{}",
    deploys: deploys.slice(0, 10).map((d) => ({
      date: d.createdDate,
      status: d.status,
      uuid: d.uuid,
    })),
    ...getProgressProps(statuses, deployStatuses),
  };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
