import { CloudFormation } from "@aws-sdk/client-cloudformation";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { z } from "zod";
import { BackendRequest } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import getWebsiteByNotebookProperties from "~/data/getWebsiteByNotebookProperties.server";

const bodySchema = z.object({ graph: z.string() });
const cf = new CloudFormation({});

const logic = async ({
  authorization,
  requestId,
  graph,
}: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(requestId);

  const userId = await authenticateRoamJSToken({
    authorization,
  });

  const website = await getWebsiteByNotebookProperties({
    requestId,
    userId,
    workspace: graph,
    appName: "roam",
  });

  if (!website) {
    await cxn.end();
    return {};
  }

  const { Stacks } = await cf
    .describeStacks({ StackName: website.stackName })
    .catch((e) => {
      if (e.message.includes("does not exist"))
        return {
          Stacks: [],
        };
      throw e;
    });

  if (!Stacks?.length) {
    await cxn.end();
    return {};
  }

  const stack = Stacks[0];
  const parameters = Object.fromEntries(
    stack.Parameters?.map((p) => [p.ParameterKey, p.ParameterValue]) ?? []
  );
  await cxn.end();
  return parameters;
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
