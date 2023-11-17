import type {
  CloudFrontRequestEvent,
  CloudFrontRequestCallback,
  Context,
} from "aws-lambda";
import { websiteRedirects } from "data/schema";
import { and, eq } from "drizzle-orm/expressions";
import getMysql from "~/data/mysql.server";

export const handler = async (
  event: CloudFrontRequestEvent,
  _: Context,
  callback: CloudFrontRequestCallback
) => {
  const request = event.Records[0].cf.request;
  const olduri = request.uri;
  const websiteUuid =
    request.origin?.custom?.customHeaders?.["x-samepage-website-uuid"]?.[0]
      ?.value ?? "";
  const cxn = await getMysql();
  const mappedUri = await cxn
    .select({ to: websiteRedirects.to })
    .from(websiteRedirects)
    .where(
      and(
        eq(websiteRedirects.websiteUuid, websiteUuid),
        eq(websiteRedirects.from, olduri)
      )
    );
  if (mappedUri) {
    return {
      status: "301",
      statusDescription: "Moved Permanently",
      headers: {
        location: [
          {
            key: "Location",
            value: mappedUri,
          },
        ],
      },
    };
  }
  if (olduri !== `/publishing/${websiteUuid}/index.html`) {
    const newuri = `/publishing/${websiteUuid}/${olduri}${
      olduri.includes(".") ? "" : ".html"
    }`;
    request.uri = encodeURI(newuri);
  }
  return callback(null, request);
};
