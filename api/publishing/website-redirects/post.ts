import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import { z } from "zod";
import { BackendRequest } from "package/internal/types";
import getWebsiteUuidByRoamJSToken from "~/data/getWebsiteUuidByRoamJSToken.data";
import getMysql from "~/data/mysql.server";
import { websiteRedirects } from "data/schema";
import { and, eq } from "drizzle-orm";
import { v4 } from "uuid";
import { BadRequestError } from "~/data/errors.server";

const bodySchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("GET"),
  }),
  z.object({
    method: z.literal("SUBMIT"),
    redirects: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .array(),
  }),
  z.object({
    method: z.literal("DELETE"),
    uuid: z.string(),
  }),
]);

export const logic = async ({
  authorization,
  requestId,
  ...rest
}: BackendRequest<typeof bodySchema>) => {
  const websiteUuid = await getWebsiteUuidByRoamJSToken({
    authorization,
    requestId,
  });
  const cxn = await getMysql(requestId);
  switch (rest.method) {
    case "GET": {
      const redirects = await cxn
        .select({
          uuid: websiteRedirects.uuid,
          from: websiteRedirects.from,
          to: websiteRedirects.to,
          createdDate: websiteRedirects.createdDate,
        })
        .from(websiteRedirects)
        .where(eq(websiteRedirects.websiteUuid, websiteUuid));
      await cxn.end();
      return {
        redirects,
      };
    }
    case "SUBMIT": {
      const { redirects } = rest;

      await cxn.insert(websiteRedirects).values(
        ...redirects.map((r) => ({
          ...r,
          uuid: v4(),
          websiteUuid,
          createdDate: new Date(),
        }))
      );
      return { success: true };
    }
    case "DELETE": {
      const uuid = rest.uuid as string;
      await cxn
        .delete(websiteRedirects)
        .where(
          and(
            eq(websiteRedirects.uuid, uuid),
            eq(websiteRedirects.websiteUuid, websiteUuid)
          )
        );
      return { success: true };
    }
    default:
      throw new BadRequestError(`Unsupported method ${rest["method"]}`);
  }
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
