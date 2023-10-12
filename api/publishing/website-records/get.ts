import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import getWebsiteUuid from "~/data/getWebsiteUuid.data";
import getHostedZoneByWebsiteUuid from "~/data/getHostedZoneByWebsiteUuid.server";
import { BackendRequest } from "package/internal/types";
import { Route53 } from "@aws-sdk/client-route-53";

const route53 = new Route53({});

export const logic = async ({ authorization, requestId }: BackendRequest) => {
  const websiteUuid = await getWebsiteUuid(authorization);
  if (!websiteUuid) {
    return { records: [] };
  }

  const { HostedZoneId, domain } = await getHostedZoneByWebsiteUuid({
    websiteUuid,
    requestId,
  });

  if (!HostedZoneId) return { records: [] };

  const { ResourceRecordSets = [] } = await route53.listResourceRecordSets({
    HostedZoneId,
  });

  return {
    records: ResourceRecordSets.filter(
      (r) =>
        r.Name?.endsWith(`${domain}.`) && !["NS", "SOA"].includes(r.Type ?? "")
    ).flatMap((r) =>
      (r.ResourceRecords ?? []).map((rec) => ({
        name:
          r.Name === `${domain}.`
            ? domain
            : r.Name?.replace(
                new RegExp(`\\.?${domain.replace(".", "\\.")}\\.$`),
                ""
              ),
        type: r.Type,
        value: rec.Value,
      }))
    ),
  };
};

export default createAPIGatewayProxyHandler(logic);
