import { Lambda } from "@aws-sdk/client-lambda";
import { GetAccessTokenPayload, zGetAccessTokenResponse } from "./types";

const lambda = new Lambda({ endpoint: process.env.AWS_ENDPOINT });

const getAccessToken = (payload: GetAccessTokenPayload) => {
  return lambda
    .invoke({
      FunctionName: "samepage-network_access",
      Payload: Buffer.from(JSON.stringify(payload)),
    })
    .then((res) => {
      const payload = Buffer.from(res.Payload ?? []).toString() || "{}";
      if (res.FunctionError) {
        throw new Error(payload);
      }
      return zGetAccessTokenResponse.parse(JSON.parse(payload));
    });
};

export default getAccessToken;
