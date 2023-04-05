import { Lambda } from "@aws-sdk/client-lambda";
import { z } from "zod";

const zResponse = z.object({
  accessToken: z.string(),
  workspace: z.string(),
  uuid: z.string(),
  token: z.string(),
});

const lambda = new Lambda({ endpoint: process.env.AWS_ENDPOINT });

const getAccessToken = (authorization: string) => {
  return lambda
    .invoke({
      FunctionName: "samepage-network_access",
      Payload: Buffer.from(JSON.stringify({ authorization })),
    })
    .then((res) => {
      const payload = Buffer.from(res.Payload ?? []).toString() || "{}";
      if (res.FunctionError) {
        throw new Error(payload);
      }
      return zResponse.parse(JSON.parse(payload));
    });
};

export default getAccessToken;
