import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { z } from "zod";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import { NotFoundError } from "~/data/errors.server";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";
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

  return {
    themes: [
      {
        name: "Default",
        description: "A default theme for testing",
        thumbnail: "https://roamjs.com/images/logo.png",
        value: "#content {\n  width: 320px;\n}",
      },
    ],
  };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
