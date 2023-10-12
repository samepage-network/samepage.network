import { CloudFormation } from "@aws-sdk/client-cloudformation";
import getMysql from "./mysql.server";
import { eq } from "drizzle-orm/expressions";
import { websites } from "data/schema";
import getHostedZoneByDomain from "./getHostedZoneByDomain.server";

const cf = new CloudFormation({});

const getHostedZoneByWebsiteUuid = async ({
  websiteUuid,
  requestId,
}: {
  websiteUuid: string;
  requestId: string;
}) => {
  const cxn = await getMysql(requestId);
  const StackName = await cxn
    .select({ stackName: websites.stackName })
    .from(websites)
    .where(eq(websites.uuid, websiteUuid))
    .then((res) => res[0]?.stackName);
  const stackParameters = await cf
    .describeStacks({ StackName })
    .then((c) => c.Stacks?.[0].Parameters || [])
    .then((params) =>
      Object.fromEntries(params.map((p) => [p.ParameterKey, p.ParameterValue]))
    );
  const isCustomDomain = stackParameters["CustomDomain"];
  const domain = stackParameters["DomainName"];
  if (isCustomDomain === "true") {
    return await getHostedZoneByDomain(domain).then((HostedZoneId) => ({
      HostedZoneId,
      domain,
    }));
  } else if (isCustomDomain === "false") {
    return { HostedZoneId: process.env.ROAMJS_ZONE_ID, domain };
  } else {
    return { HostedZoneId: "", domain: "" };
  }
};

export default getHostedZoneByWebsiteUuid;
