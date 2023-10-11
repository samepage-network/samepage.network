import { v4 } from "uuid";
import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import { BadRequestError } from "~/data/errors.server";
import getMysql from "~/data/mysql.server";
import { websiteSharing } from "data/schema";
import { eq } from "drizzle-orm/expressions";

type GetArgs = { method: "GET"; authorization: string; requestId: string };
type UpdateArgs = {
  method: "UPDATE";
  authorization: string;
  requestId: string;
  uuid: string;
  date: string;
  permission: "NONE" | "DEPLOY";
};
type CreateArgs = {
  method: "CREATE";
  authorization: string;
  requestId: string;
  user: string;
};
type DeleteArgs = {
  method: "DELETE";
  authorization: string;
  requestId: string;
  uuid: string;
  date: string;
};
type Args = GetArgs | UpdateArgs | CreateArgs | DeleteArgs;

const getWebsiteUuid = async (authorization: string) => authorization;

const logic = async (args: Args) => {
  const websiteUuid = await getWebsiteUuid(args.authorization);
  const cxn = await getMysql();
  switch (args.method) {
    case "GET":
      return cxn
        .select({
          uuid: websiteSharing.uuid,
          permission: websiteSharing.permission,
          user: websiteSharing.userId,
          date: websiteSharing.createdDate,
        })
        .from(websiteSharing)
        .where(eq(websiteSharing.websiteUuid, websiteUuid))
        .then((perms) => ({
          perms,
        }));
    case "UPDATE": {
      const { uuid, permission } = args;
      return cxn
        .update(websiteSharing)
        .set({
          permission,
        })
        .where(eq(websiteSharing.uuid, uuid))
        .then(() => ({ success: true }));
    }
    case "CREATE": {
      const user = {
        uuid: v4(),
        userId: args.user,
        createdDate: new Date(),
        permission: "NONE" as const,
        websiteUuid,
      };
      return cxn
        .insert(websiteSharing)
        .values(user)
        .then(() => user);
    }
    case "DELETE": {
      const uuid = args.uuid;
      return cxn
        .delete(websiteSharing)
        .where(eq(websiteSharing.uuid, uuid))
        .then(() => ({ success: true }));
    }
    default:
      throw new BadRequestError(`Method ${args["method"]} not supported`);
  }
};

export default createAPIGatewayProxyHandler(logic);
