import {
  apps,
  notebooks,
  tokenNotebookLinks,
  websiteNotebookLinks,
  websiteSharing,
  websites,
} from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import { tokens } from "out/migrations/schema";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { v4 } from "uuid";
import { z } from "zod";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import { ForbiddenError } from "~/data/errors.server";
import invokeAsync from "~/data/invokeAsync.server";
import logWebsiteStatus from "~/data/logWebsiteStatus.server";
import getMysql from "~/data/mysql.server";

const bodySchema = z.object({ graph: z.string(), domain: z.string() });

const logic = async ({
  authorization,
  requestId,
  graph,
  domain,
}: BackendRequest<typeof bodySchema>) => {
  const cxn = await getMysql(requestId);

  const userId = await authenticateRoamJSToken({
    authorization,
  });

  const [notebook] = await cxn
    .select({ notebookUuid: notebooks.uuid })
    .from(notebooks)
    .innerJoin(
      tokenNotebookLinks,
      eq(notebooks.uuid, tokenNotebookLinks.notebookUuid)
    )
    .innerJoin(tokens, eq(tokenNotebookLinks.tokenUuid, tokens.uuid))
    .where(
      and(
        eq(notebooks.workspace, graph),
        eq(tokens.userId, userId),
        eq(apps.name, "roam")
      )
    );
  if (!notebook) {
    await cxn.end();
    throw new ForbiddenError(
      "Must have a notebook on SamePage in order to launch a website."
    );
  }

  const websiteUuid = v4();
  const createdDate = new Date();
  await cxn.insert(websites).values({
    stackName: `${graph}-${domain}`,
    uuid: websiteUuid,
    createdDate,
  });
  await cxn.insert(websiteNotebookLinks).values({
    websiteUuid,
    notebookUuid: notebook.notebookUuid,
  });
  await cxn.insert(websiteSharing).values({
    websiteUuid,
    userId,
    createdDate,
    permission: "DEPLOY",
  });

  await logWebsiteStatus({
    websiteUuid,
    status: "INITIALIZING",
    requestId,
    statusType: "LAUNCH",
  });

  await invokeAsync({
    path: "launch",
    data: {
      websiteUuid,
      domain: domain.toLowerCase(),
    },
  });

  await cxn.end();

  return { websiteUuid, domain };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
