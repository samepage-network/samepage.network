import { websiteSharing } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import authenticateNotebook from "./authenticateNotebook.server";
import authenticateRoamJSToken from "./authenticateRoamJSToken.server";
import getMysql from "./mysql.server";

const getWebsiteUuidByRoamJSToken = async ({
  authorization,
  requestId,
}: {
  authorization?: string;
  requestId: string;
}) => {
  const { notebookUuid, token } = await authenticateRoamJSToken({
    requestId,
    authorization,
  });

  const { userId } = await authenticateNotebook({
    requestId,
    token,
    notebookUuid,
  });

  const cxn = await getMysql(requestId);
  const userWebsites = await cxn
    .select({ websiteUuid: websiteSharing.websiteUuid })
    .from(websiteSharing)
    .where(
      and(
        eq(websiteSharing.permission, "DEPLOY"),
        eq(websiteSharing.userId, userId)
      )
    );
  return userWebsites[0]?.websiteUuid;
};
export default getWebsiteUuidByRoamJSToken;
