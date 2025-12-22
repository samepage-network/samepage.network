import {
  apps,
  notebooks,
  tokenNotebookLinks,
  tokens,
  websiteNotebookLinks,
  websiteSharing,
  websites,
} from "data/schema";
import { and, eq } from "drizzle-orm";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { BackendRequest } from "package/internal/types";
import { v4 } from "uuid";
import { z } from "zod";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import { ForbiddenError } from "~/data/errors.server";
import invokeAsync from "~/data/invokeAsync.server";
import getMysql from "~/data/mysql.server";
import startWebsiteOperation from "~/data/startWebsiteOperation.server";

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
    .innerJoin(apps, eq(apps.id, notebooks.app))
    .where(
      and(
        eq(notebooks.workspace, graph),
        eq(tokens.userId, userId),
        eq(apps.name, "roam")
      )
    );
  if (!notebook) {
    throw new ForbiddenError(
      "Must have a notebook on SamePage in order to launch a website."
    );
  }

  const websiteUuid = v4();
  const createdDate = new Date();
  await cxn.insert(websites).values({
    stackName: `samepage-${websiteUuid}`,
    uuid: websiteUuid,
    createdDate,
  });
  await cxn.insert(websiteNotebookLinks).values({
    uuid: v4(),
    websiteUuid,
    notebookUuid: notebook.notebookUuid,
  });
  await cxn.insert(websiteSharing).values({
    uuid: v4(),
    websiteUuid,
    userId,
    createdDate,
    permission: "DEPLOY",
  });

  const logStatus = await startWebsiteOperation({
    websiteUuid,
    requestId,
    statusType: "LAUNCH",
  });
  await logStatus("INITIALIZING");

  await invokeAsync({
    path: "launch",
    data: {
      websiteUuid,
      requestId,
      domain: domain.toLowerCase(),
      userId,
    },
  });

  await cxn.end();

  return { websiteUuid, domain };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
