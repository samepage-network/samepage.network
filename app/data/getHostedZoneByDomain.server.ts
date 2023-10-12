import { Route53 } from "@aws-sdk/client-route-53";

const route53 = new Route53({});

const getHostedZoneByDomain = async (
  domain?: string
): Promise<string | undefined> => {
  if (!domain) return undefined;
  const trace = {
    finished: false,
    Marker: undefined as string | undefined,
  };
  while (!trace.finished) {
    const {
      HostedZones = [],
      IsTruncated,
      NextMarker,
    } = await route53.listHostedZones({ Marker: trace.Marker });
    const zone = HostedZones.find((i) => i.Name === `${domain}.`);
    if (zone) {
      return zone.Id;
    }
    trace.finished = !IsTruncated;
    trace.Marker = NextMarker;
  }

  return undefined;
};

export default getHostedZoneByDomain;
