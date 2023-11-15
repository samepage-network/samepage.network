import { z } from "zod";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import getMysql from "~/data/mysql.server";
import { BackendRequest } from "package/internal/types";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";
import { NotFoundError } from "~/data/errors.server";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import logWebsiteStatus from "~/data/logWebsiteStatus.server";
import invokeAsync from "~/data/invokeAsync.server";
import format from "date-fns/format";
import uploadFileContent from "package/backend/uploadFileContent";

const bodySchema = z.object({ graph: z.string(), data: z.string() });

const logic = async ({
  authorization,
  requestId,
  graph,
  data,
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

  const date = new Date();
  const websiteUuid = requestedWebsite.uuid;
  await logWebsiteStatus({
    websiteUuid,
    status: "INITIALIZING",
    requestId,
    statusType: "DEPLOY",
  });

  const key = format(date, "yyyyMMddhhmmss");
  const Key = `data/publishing/${websiteUuid}/${key}.json`;
  await uploadFileContent({ Key, Body: data });

  await invokeAsync({
    path: "deploy",
    data: {
      websiteUuid,
      requestId,
      key,
    },
  });

  return { success: true };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
