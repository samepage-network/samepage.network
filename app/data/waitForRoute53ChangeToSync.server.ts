import { Route53 } from "@aws-sdk/client-route-53";

const route53 = new Route53({});

const waitForRoute53ChangeToSync = async ({
  Id,
  count = 0,
}: {
  Id: string;
  count?: number;
}): Promise<void> => {
  const { ChangeInfo } = await route53.getChange({ Id });

  if (ChangeInfo?.Status === "INSYNC") {
    return;
  }
  if (count === 500)
    return Promise.reject(
      `Timed out waiting for change: ${Id}. Last status: ${ChangeInfo?.Status}`
    );
  return new Promise((resolve) =>
    setTimeout(
      () => resolve(waitForRoute53ChangeToSync({ Id, count: count + 1 })),
      1000
    )
  );
};

export default waitForRoute53ChangeToSync;
