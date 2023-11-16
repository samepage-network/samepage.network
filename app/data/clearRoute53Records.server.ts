import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { Route53 } from "@aws-sdk/client-route-53";

const route53 = new Route53({});
const cf = new CloudFormation({});

const waitForChangeToSync = ({
  Id,
  count = 0,
}: {
  Id: string;
  count?: number;
}) => {
  route53
    .getChange({ Id })
    .then(({ ChangeInfo }) =>
      ChangeInfo?.Status === "INSYNC"
        ? Promise.resolve()
        : count === 500
        ? Promise.reject(
            `Timed out waiting for change: ${Id}. Last status: ${ChangeInfo?.Status}`
          )
        : new Promise((resolve) =>
            setTimeout(
              () => resolve(waitForChangeToSync({ Id, count: count + 1 })),
              1000
            )
          )
    );
};

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
        .then(
          ({ ChangeInfo }) =>
            ChangeInfo?.Id && waitForChangeToSync({ Id: ChangeInfo.Id })
        );
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
