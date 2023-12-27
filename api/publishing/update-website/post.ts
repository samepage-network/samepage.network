import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { z } from "zod";
import { BackendRequest } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";
import { NotFoundError } from "~/data/errors.server";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import { CloudFormation } from "@aws-sdk/client-cloudformation";
import startWebsiteOperation from "~/data/startWebsiteOperation.server";

const cf = new CloudFormation({});

const bodySchema = z.object({
  graph: z.string(),
  diffs: z.object({ key: z.string(), value: z.string() }).array().min(1),
});

const logic = async ({
  authorization,
  requestId,
  graph,
  diffs,
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
  const logStatus = await startWebsiteOperation({
    websiteUuid,
    requestId,
    statusType: "LAUNCH",
  });
  await logStatus("UPDATING");

  const { Stacks = [] } = await cf.describeStacks({
    StackName: requestedWebsite.stackName,
  });
  const originalParameters = Stacks[0]?.Parameters ?? [];
  const diffObject = Object.fromEntries(
    diffs.map(({ key, value }) => [key, value])
  );
  await cf.updateStack({
    StackName: requestedWebsite.stackName,
    Parameters: originalParameters.map(({ ParameterKey }) =>
      ParameterKey && diffObject[ParameterKey]
        ? {
            ParameterKey,
            ParameterValue: diffObject[ParameterKey],
          }
        : {
            ParameterKey,
            UsePreviousValue: true,
          }
    ),
    UsePreviousTemplate: true,
  });

  return { success: true };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
