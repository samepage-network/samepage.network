import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { Route53 } from "@aws-sdk/client-route-53";
import waitForRoute53ChangeToSync from "./waitForRoute53ChangeToSync.server";

const route53 = new Route53({});
const cf = new CloudFormation({});

export const clearRecordsById = async (HostedZoneId?: string) => {
  if (HostedZoneId) {
    const CNAME = await route53
      .listResourceRecordSets({ HostedZoneId })
      .then(({ ResourceRecordSets = [] }) =>
        ResourceRecordSets.find((r) => r.Type === "CNAME")
      );
    if (CNAME) {
      await route53
        .changeResourceRecordSets({
          HostedZoneId,
          ChangeBatch: {
            Changes: [{ Action: "DELETE", ResourceRecordSet: CNAME }],
          },
        })
        .then(async ({ ChangeInfo }) => {
          if (ChangeInfo?.Id)
            await waitForRoute53ChangeToSync({ Id: ChangeInfo.Id });
        });
    }
  }
};

const clearRecords = async (StackName: string) => {
  const summaries = await cf
    .listStackResources({ StackName })
    .then(({ StackResourceSummaries = [] }) => StackResourceSummaries);
  const HostedZoneId = (summaries || []).find(
    (s) => s.LogicalResourceId === "HostedZone"
  )?.PhysicalResourceId;
  await clearRecordsById(HostedZoneId);
};

export default clearRecords;
