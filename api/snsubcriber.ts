import { Route53 } from "@aws-sdk/client-route-53";
import { SNSEvent } from "aws-lambda";
import logWebsiteStatus from "~/data/logWebsiteStatus.server";
import { v4 } from "uuid";
import { Json } from "package/internal/types";
import getMysql from "~/data/mysql.server";
import { websiteStatuses, websites } from "data/schema";
import { desc, eq } from "drizzle-orm/expressions";
import { CloudFormation } from "@aws-sdk/client-cloudformation";
import { CloudFront } from "@aws-sdk/client-cloudfront";
import { SES } from "@aws-sdk/client-ses";
import { z } from "zod";
import authenticateRoamJSToken from "~/data/authenticateRoamJSToken.server";
import getPrimaryUserEmail from "~/data/getPrimaryUserEmail.server";
import getHostedZoneByDomain from "~/data/getHostedZoneByDomain.server";
import clearRecords, {
  clearRecordsById,
} from "~/data/clearRoute53Records.server";
import deleteWebsite from "~/data/deleteWebsite.server";
import isSystemDomain from "~/data/isSystemDomain.server";
import getLatestOperation from "~/data/getLatestOperation.server";
import completeWebsiteOperation from "~/data/completeWebsiteOperation.server";

const route53 = new Route53({});
const cf = new CloudFormation({});
const cloudfront = new CloudFront({});
const ses = new SES({});
const ACM_START_TEXT = "Content of DNS Record is: ";
const SHUTDOWN_CALLBACK_STATUS = "PREPARING TO DELETE STACK";

const factory = (resource: string) => ({
  CREATE_IN_PROGRESS: `CREATING ${resource}`,
  CREATE_COMPLETE: `${resource} CREATED`,
  DELETE_IN_PROGRESS: `DELETING ${resource}`,
  DELETE_COMPLETE: `${resource} DELETED`,
  UPDATE_IN_PROGRESS: `UPDATING ${resource}`,
  UPDATE_COMPLETE: `${resource} UPDATED`,
});

type Status = ReturnType<typeof factory>;

const STATUSES = {
  HostedZone: factory("ZONE"),
  AcmCertificate: factory("CERTIFICATE"),
  CloudfrontDistribution: factory("NETWORK"),
  Route53ARecord: factory("DOMAIN"),
  Route53AAAARecord: factory("ALTERNATE DOMAIN"),
  AcmCertificateSystem: factory("CERTIFICATE"),
  CloudfrontDistributionSystem: factory("NETWORK"),
  Route53ARecordSystem: factory("DOMAIN"),
  Route53AAAARecordSystem: factory("ALTERNATE DOMAIN"),
  CloudwatchRule: factory("DEPLOYER"),
};

const logic = async ({
  logStatus,
  StackName,
  requestId,
  ResourceStatus,
  ResourceStatusReason,
  LogicalResourceId,
  PhysicalResourceId,
  websiteUuid,
  messageObject,
  operationUuid,
}: {
  logStatus: (status: string, props?: Record<string, Json>) => Promise<void>;
  StackName: string;
  requestId: string;
  ResourceStatus: string;
  ResourceStatusReason: string;
  LogicalResourceId: string;
  PhysicalResourceId: string;
  websiteUuid: string;
  messageObject: Record<string, string>;
  operationUuid: string;
}) => {
  const cxn = await getMysql(requestId);
  const { Stacks = [] } = await cf
    .describeStacks({
      StackName,
    })
    .catch(() => ({ Stacks: [] }));
  const originalParameters = Object.fromEntries(
    (Stacks[0]?.Parameters ?? []).map(
      ({ ParameterKey = "", ParameterValue = "" }) =>
        [ParameterKey, ParameterValue] as const
    )
  );

  const environment = originalParameters["Environment"];
  if (environment === "development") {
    await fetch("https://api.samepage.ngrok.io/publishing/snsubscriber", {
      method: "POST",
      body: JSON.stringify({ event }),
      headers: {
        Authorization: process.env.SAMEPAGE_DEVELOPMENT_TOKEN ?? "",
      },
    });
    return;
  }

  const getHostedZoneByStackName = async () => {
    const isCustomDomain = originalParameters["CustomDomain"];
    const domain = originalParameters["DomainName"];
    if (isCustomDomain === "true") {
      return await getHostedZoneByDomain(domain).then((HostedZoneId) => ({
        HostedZoneId,
        domain,
      }));
    } else if (isCustomDomain === "false") {
      return { HostedZoneId: process.env.SAMEPAGE_HOSTED_ZONE_ID, domain };
    } else {
      return { HostedZoneId: "", domain: "" };
    }
  };
  if (LogicalResourceId === StackName) {
    if (
      ResourceStatus === "CREATE_COMPLETE" ||
      ResourceStatus === "UPDATE_COMPLETE" ||
      ResourceStatus === "UPDATE_ROLLBACK_COMPLETE"
    ) {
      const domain = originalParameters["DomainName"];

      await logStatus("LIVE");
      await completeWebsiteOperation({ operationUuid, requestId });
      const email = originalParameters["Email"];
      if (
        ResourceStatus === "CREATE_COMPLETE" &&
        environment === "production"
      ) {
        if (domain.split(".").length > 2 && !isSystemDomain(".roamjs.com")) {
          const Id = await cf
            .listStackResources({ StackName })
            .then(({ StackResourceSummaries = [] }) => StackResourceSummaries)
            .then(
              (summaries) =>
                summaries.find(
                  (s) => s.LogicalResourceId === "CloudfrontDistribution"
                )?.PhysicalResourceId
            );
          const cloudfrontDomain = await cloudfront
            .getDistribution({ Id })
            .then((r) => r.Distribution?.DomainName);
          await ses.sendEmail({
            Destination: {
              ToAddresses: [email],
            },
            Message: {
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: `Now, for your site to be accessible at ${domain}, you will need to add one more DNS record to the settings of your domain:\n\nType: CNAME\nName: ${domain}\nValue: ${cloudfrontDomain}`,
                },
              },
              Subject: {
                Charset: "UTF-8",
                Data: `Your RoamJS site is almost ready!`,
              },
            },
            Source: "support@samepage.network",
          });
        } else {
          await ses.sendEmail({
            Destination: {
              ToAddresses: [email],
            },
            Message: {
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: `Your static site is live and accessible at ${domain}.`,
                },
              },
              Subject: {
                Charset: "UTF-8",
                Data: `Your RoamJS site is now live!`,
              },
            },
            Source: "support@samepage.network",
          });
        }
      }
    } else if (ResourceStatus === "DELETE_COMPLETE") {
      await logStatus("INACTIVE");
      await completeWebsiteOperation({ operationUuid, requestId });
      const shutdownCallback = await cxn
        .select({
          props: websiteStatuses.props,
          status: websiteStatuses.status,
        })
        .from(websiteStatuses)
        .where(eq(websiteStatuses.websiteUuid, websiteUuid))
        .orderBy(desc(websiteStatuses.createdDate))
        .then(
          (r) => r.find((i) => i.status === SHUTDOWN_CALLBACK_STATUS)?.props
        );
      if (shutdownCallback) {
        const { authorization } = z
          .object({ authorization: z.string() })
          .parse(shutdownCallback);
        const userId = await authenticateRoamJSToken({
          authorization,
        });

        await deleteWebsite({ requestId, websiteUuid });

        const email = await getPrimaryUserEmail(userId);
        if (email && environment === "production")
          await ses.sendEmail({
            Destination: {
              ToAddresses: [email],
            },
            Message: {
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: `Your SamePage website is no longer live. There are no sites connected to your notebook.\n\nIf you believe you received this email in error, please reach out to support@samepage.network.`,
                },
              },
              Subject: {
                Charset: "UTF-8",
                Data: `Your SamePage website has successfully shutdown.`,
              },
            },
            Source: "support@samepage.network",
          });
      } else {
        console.error("Could not find Shutdown Callback Status");
      }
    } else if (ResourceStatus === "ROLLBACK_COMPLETE") {
      await logStatus("INACTIVE");
      // TODO delete stack
    } else if (ResourceStatus === "ROLLBACK_IN_PROGRESS") {
      await logStatus("ROLLING BACK RESOURCES");
      // TODO set user's site in "rolling back state"
      // TODO email user that rollback is happening, adk RoamJS why
      // TODO support a notification system within the Static Site Dashboard itself
    } else if (ResourceStatus === "ROLLBACK_FAILED") {
      await logStatus("ROLLBACK FAILED", {
        failureReason: ResourceStatusReason,
      });
    } else if (ResourceStatus === "CREATE_IN_PROGRESS") {
      await logStatus("CREATING RESOURCES");
    } else if (ResourceStatus === "DELETE_IN_PROGRESS") {
      await logStatus("BEGIN DESTROYING RESOURCES");
    } else {
      await logStatus("MAKING PROGRESS", messageObject);
    }
  } else if (ResourceStatusReason.startsWith(ACM_START_TEXT)) {
    const { HostedZoneId, domain } = await getHostedZoneByStackName();

    if (!isSystemDomain(domain) && HostedZoneId) {
      const { ResourceRecordSets = [] } = await route53.listResourceRecordSets({
        HostedZoneId,
      });
      const email = originalParameters["Email"];
      const domainParts = domain.split(".").length;
      if (domainParts === 2) {
        const set = ResourceRecordSets.find((r) => r.Type === "NS");
        const nameServers = (set?.ResourceRecords ?? []).map(
          (r) => r.Value?.replace(/\.$/, "") ?? ""
        );
        await logStatus("AWAITING VALIDATION", { nameServers });
        if (environment === "production") {
          await ses.sendEmail({
            Destination: {
              ToAddresses: [email],
            },
            Message: {
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: `Add the following four nameservers to your domain settings.\n\n${nameServers
                    .map((ns) => `- ${ns}\n`)
                    .join(
                      ""
                    )}\nIf the domain is not validated in the next 48 hours, the website will fail to launch and a rollback will begin.`,
                },
              },
              Subject: {
                Charset: "UTF-8",
                Data: `Your RoamJS static site is awaiting validation.`,
              },
            },
            Source: "support@samepage.network",
          });
        }
      } else if (domainParts > 2) {
        const set = ResourceRecordSets.find((r) => r.Type === "CNAME");
        const cname = {
          name: set?.Name?.replace(/\.$/, "") ?? null,
          value:
            (set?.ResourceRecords ?? [])[0]?.Value?.replace(/\.$/, "") ?? null,
        };
        await logStatus("AWAITING VALIDATION", {
          cname,
        });
        if (environment === "production") {
          await ses.sendEmail({
            Destination: {
              ToAddresses: [email],
            },
            Message: {
              Body: {
                Text: {
                  Charset: "UTF-8",
                  Data: `Add the following DNS Record in the settings for your domain\n\nType: CNAME\nName: ${cname.name}\nValue: ${cname.value}`,
                },
              },
              Subject: {
                Charset: "UTF-8",
                Data: `Your RoamJS static site is awaiting validation.`,
              },
            },
            Source: "support@samepage.network",
          });
        }
      }
    } else if (isSystemDomain(domain)) {
      await logStatus("AWAITING VALIDATION");
    }
  } else if (ResourceStatus === "ROLLBACK_IN_PROGRESS") {
    await clearRecords(StackName);
  } else if (ResourceStatus === "ROLLBACK_FAILED") {
    await logStatus("ROLLBACK FAILED", {
      failureReason: ResourceStatusReason,
      resource: LogicalResourceId,
    });
  } else if (ResourceStatus === "CREATE_FAILED") {
    await logStatus("CREATE FAILED", {
      failureReason: ResourceStatusReason,
      resource: LogicalResourceId,
    });
    if (environment === "production") {
      await ses.sendEmail({
        Destination: {
          ToAddresses: ["support@samepage.network"],
        },
        Message: {
          Body: {
            Text: {
              Charset: "UTF-8",
              Data: `Stack that failed: ${StackName}\nResource that failed: ${LogicalResourceId}\nReason that it failed: ${ResourceStatusReason}`,
            },
          },
          Subject: {
            Charset: "UTF-8",
            Data: `User's Static Site failed to deploy`,
          },
        },
        Source: "support@samepage.network",
      });
    }
  } else if (ResourceStatus === "DELETE_FAILED") {
    await logStatus("DELETE FAILED", {
      failureReason: ResourceStatusReason,
      resource: LogicalResourceId,
    });
  } else {
    const loggedStatus =
      STATUSES[LogicalResourceId as keyof typeof STATUSES]?.[
        ResourceStatus as keyof Status
      ];
    if (!loggedStatus) {
      await logStatus("MAKING PROGRESS", messageObject);
    } else {
      await logStatus(loggedStatus);
    }
    if (
      ResourceStatus === "DELETE_IN_PROGRESS" &&
      LogicalResourceId === "HostedZone"
    ) {
      await logStatus("REMOVING DNS RECORDS");
      await clearRecordsById(PhysicalResourceId);
    }
  }
};

export const handler = async (event: SNSEvent) => {
  const message = event.Records[0].Sns.Message;
  const messageObject = Object.fromEntries(
    message
      .split("\n")
      .map((l) => l.split("="))
      .map(([key, value]) => [
        key,
        value && value.substring(1, value.length - 1),
      ])
  );
  const {
    StackName,
    LogicalResourceId,
    ResourceStatus,
    ResourceStatusReason,
    PhysicalResourceId,
  } = messageObject;

  const requestId = v4();
  const cxn = await getMysql(requestId);
  const websiteUuid = await cxn
    .select({ uuid: websites.uuid })
    .from(websites)
    .where(eq(websites.stackName, StackName))
    .then(([{ uuid }]) => uuid);

  const operationUuid = await getLatestOperation({
    requestId,
    websiteUuid,
  }).then((op) => op?.uuid);
  const logStatus = (status: string, props?: Record<string, Json>) =>
    logWebsiteStatus({
      websiteUuid,
      status,
      requestId,
      statusType: "LAUNCH",
      operationUuid,
      props,
    });
  try {
    await logic({
      StackName,
      logStatus,
      requestId,
      ResourceStatus,
      ResourceStatusReason,
      LogicalResourceId,
      websiteUuid,
      PhysicalResourceId,
      messageObject,
      operationUuid,
    });
    await cxn.end();
  } catch (e) {
    console.error(e);
    await logStatus("INTERNAL SERVER ERROR", { error: (e as Error).message });
    await cxn.end();
  }
};
