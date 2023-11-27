import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { z } from "zod";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import deleteWebsite from "~/data/deleteWebsite.server";
import { NotFoundError } from "~/data/errors.server";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";
import invokeAsync from "~/data/invokeAsync.server";
import logWebsiteStatus from "~/data/logWebsiteStatus.server";
import getMysql from "~/data/mysql.server";

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

  const requestedWebsite = await getWebsiteByNotebookProperties({
    requestId,
    userId,
    workspace: graph,
    appName: "roam",
  });

  if (!requestedWebsite) {
    const email = await getPrimaryUserEmail(userId);

    if (!email?.endsWith("@samepage.network")) {
      await cxn.end();
      throw new NotFoundError("Website not found.");
    }
  }

  const websiteUuid = requestedWebsite.uuid;
  if (!requestedWebsite.live) {
    await deleteWebsite({ websiteUuid, requestId });
    await cxn.end();
    return { success: true };
  }

  await logWebsiteStatus({
    websiteUuid,
    status: "SHUTTING DOWN",
    requestId,
    statusType: "LAUNCH",
  });

  await invokeAsync({
    path: "shutdown",
    data: {
      websiteUuid,
      authorization,
      requestId,
    },
  });

  return { success: true };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
