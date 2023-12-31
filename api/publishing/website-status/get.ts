import {
  websiteSharing,
  websiteStatuses,
  WebsiteStatusType,
} from "data/schema";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest, JSONData } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm/expressions";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";

type WebsiteStatus = {
  uuid: string;
  status: string;
  statusType: WebsiteStatusType;
  props: JSONData;
  createdDate: Date;
};

const getProgressProps = (
  items: WebsiteStatus[],
  deployItems: WebsiteStatus[]
) => {
  if (!items) {
    return { progress: 0, progressType: "LAUNCHING" as const };
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
    if (deployIndex >= 0) {
      return { progress: deployIndex / 5, progressType: "DEPLOYING" as const };
    }
    return { progress: launchIndex / 26, progressType: "LAUNCHING" as const };
  } else if (updateIndex === minIndex) {
    return { progress: updateIndex / 20, progressType: "UPDATING" as const };
  } else {
    return {
      progress: shutdownIndex / 18,
      progressType: "SHUTTING DOWN" as const,
    };
  }
};

const bodySchema = z.object({ graph: z.string() });
const COMPLETE_STATUSES = ["SUCCESS", "FAILURE", "LIVE"];

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

  const defaultData = {
    isWebsiteReady: true,
    launches: [],
    deploys: [],
  };

  if (!userWebsites.length) {
    await cxn.end();
    return defaultData;
  }

  const requestedWebsite = await getWebsiteByNotebookProperties({
    requestId,
    userId,
    workspace: graph,
    appName: "roam",
  });

  if (!requestedWebsite) {
    await cxn.end();
    return defaultData;
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
    await cxn.end();
    return defaultData;
  }

  const deployStatuses = statuses.filter((s) => s.statusType === "DEPLOY");
  const completeDeployStatuses = deployStatuses.filter((s) =>
    COMPLETE_STATUSES.includes(s.status)
  );
  const firstDeployStatus = deployStatuses[0];
  const deploys =
    completeDeployStatuses[0] === firstDeployStatus
      ? completeDeployStatuses
      : firstDeployStatus?.statusType === "DEPLOY"
      ? [firstDeployStatus, ...completeDeployStatuses]
      : [];
  const isDeployReady =
    !deployStatuses.length ||
    completeDeployStatuses[0]?.uuid === deployStatuses[0].uuid;

  const launchStatuses = statuses.filter((s) => s.statusType === "LAUNCH");
  const completeLaunchStatuses = launchStatuses.filter((s) =>
    COMPLETE_STATUSES.includes(s.status)
  );
  const firstLaunchStatus = launchStatuses[0];
  const launches =
    completeLaunchStatuses[0] === firstLaunchStatus
      ? completeLaunchStatuses
      : firstLaunchStatus?.statusType === "LAUNCH"
      ? [firstLaunchStatus, ...completeLaunchStatuses]
      : [];
  const isLaunchReady =
    !launchStatuses.length ||
    completeLaunchStatuses[0]?.uuid === launchStatuses[0].uuid;

  await cxn.end();
  return {
    isWebsiteReady: isDeployReady && isLaunchReady,
    deploys: deploys.slice(0, 10).map((d) => ({
      date: d.createdDate,
      status: d.status,
      uuid: d.uuid,
      props: d.props,
    })),
    launches: launches.slice(0, 10).map((d) => ({
      date: d.createdDate,
      status: d.status,
      uuid: d.uuid,
      props: d.props,
    })),

    // DEPRECATED - move into above somehow...
    ...getProgressProps(statuses, deployStatuses),
  };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
