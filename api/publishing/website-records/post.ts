import getHostedZoneByWebsiteUuid from "~/data/getHostedZoneByWebsiteUuid.server";
import { BackendRequest } from "package/internal/types";
import { Route53 } from "@aws-sdk/client-route-53";
import createPublicAPIGatewayProxyHandler from "package/backend/createPublicAPIGatewayProxyHandler";
import getWebsiteUuidByRoamJSToken from "~/data/getWebsiteUuidByRoamJSToken.data";
import { NotFoundError } from "~/data/errors.server";
import { z } from "zod";
import waitForRoute53ChangeToSync from "~/data/waitForRoute53ChangeToSync.server";

const route53 = new Route53({});
const bodySchema = z.object({
  record: z.object({
    name: z.string(),
    type: z.string(),
    value: z.string(),
  }),
});

export const logic = async ({
  authorization,
  requestId,
  record,
}: BackendRequest<typeof bodySchema>) => {
  const websiteUuid = await getWebsiteUuidByRoamJSToken({
    authorization,
    requestId,
  });
  if (!websiteUuid) {
    return { records: [] };
  }

  const { HostedZoneId, domain } = await getHostedZoneByWebsiteUuid({
    websiteUuid,
    requestId,
  });

  if (!HostedZoneId) throw new NotFoundError(`Could not find Hosted Zone`);

  const Name =
    record.name === domain
      ? `${domain}.`
      : `${record.name.replace(/\.$/, "")}.${domain}.`;
  const { ResourceRecordSets = [] } = await route53.listResourceRecordSets({
    HostedZoneId,
  });
  const existing = ResourceRecordSets.find(
    (r) => r.Name === Name && r.Type === record.type
  );

  const Changes = existing
    ? [
        {
          Action: "UPSERT",
          ResourceRecordSet: {
            Name,
            Type: record.type,
            ResourceRecords: (existing.ResourceRecords || []).concat([
              { Value: record.value },
            ]),
            TTL: 300,
          },
        },
      ]
    : [
        {
          Action: "CREATE",
          ResourceRecordSet: {
            Name,
            Type: record.type,
            ResourceRecords: [{ Value: record.value }],
            TTL: 300,
          },
        },
      ];
  const { ChangeInfo } = await route53.changeResourceRecordSets({
    HostedZoneId,
    ChangeBatch: {
      Changes,
    },
  });
  await waitForRoute53ChangeToSync({ Id: ChangeInfo?.Id ?? "" });
  return { success: true };
};

export default createPublicAPIGatewayProxyHandler({ logic, bodySchema });
