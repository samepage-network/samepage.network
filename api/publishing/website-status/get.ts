import {
  websiteOperations,
  websiteSharing,
  websiteStatuses,
} from "data/schema";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";

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

  const launches = await cxn
    .select({
      uuid: websiteOperations.uuid,
      statusType: websiteOperations.statusType,
      createdDate: websiteOperations.createdDate,
      completedDate: websiteOperations.completedDate,
      status: websiteStatuses.status,
      props: websiteStatuses.props,
    })
    .from(websiteOperations)
    .innerJoin(
      websiteStatuses,
      eq(websiteOperations.uuid, websiteStatuses.operationUuid)
    )
    .where(
      and(
        eq(websiteOperations.websiteUuid, requestedWebsite.uuid),
        eq(websiteOperations.statusType, "LAUNCH")
      )
    )
    .orderBy(desc(websiteStatuses.createdDate));

  const deploys = await cxn
    .select({
      uuid: websiteOperations.uuid,
      statusType: websiteOperations.statusType,
      createdDate: websiteOperations.createdDate,
      completedDate: websiteOperations.completedDate,
      status: websiteStatuses.status,
      props: websiteStatuses.props,
    })
    .from(websiteOperations)
    .innerJoin(
      websiteStatuses,
      eq(websiteOperations.uuid, websiteStatuses.operationUuid)
    )
    .where(
      and(
        eq(websiteOperations.websiteUuid, requestedWebsite.uuid),
        eq(websiteOperations.statusType, "DEPLOY")
      )
    )
    .orderBy(desc(websiteStatuses.createdDate));

  if (!deploys.length || !launches.length) {
    await cxn.end();
    return defaultData;
  }

  const isDeployReady = !!deploys[0].completedDate;
  const isLaunchReady = !!launches[0].completedDate;

  const deployIds = new Set();
  const launchIds = new Set();

  await cxn.end();
  return {
    isWebsiteReady: isDeployReady && isLaunchReady,
    deploys: deploys
      .filter((d) => {
        if (deployIds.has(d.uuid)) {
          return false;
        }
        deployIds.add(d.uuid);
        return true;
      })
      .slice(0, 10)
      .map((d) => ({
        date: d.createdDate,
        status: d.status,
        uuid: d.uuid,
        props: d.props,
        completedDate: d.completedDate,
      })),
    launches: launches
      .filter((d) => {
        if (launchIds.has(d.uuid)) {
          return false;
        }
        launchIds.add(d.uuid);
        return true;
      })
      .slice(0, 10)
      .map((d) => ({
        date: d.createdDate,
        completedDate: d.completedDate,
        status: d.status,
        uuid: d.uuid,
        props: d.props,
      })),
  };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
