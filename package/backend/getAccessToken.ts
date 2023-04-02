import { Lambda } from "@aws-sdk/client-lambda";
import { z } from "zod";

const zResponse = z.object({
  accessToken: z.string(),
});

const lambda = new Lambda({});

const getAccessToken = (authorization: string) => {
  return lambda
    .invoke({
      FunctionName: "samepage-extension_get-access-token",
      Payload: Buffer.from(JSON.stringify({ authorization })),
    })
    .then((res) => {
      if (res.FunctionError) {
        throw new Error(res.Payload?.toString());
      }
      return zResponse.parse(JSON.parse(res.Payload?.toString() ?? "{}"))
        .accessToken;
    });
};

export default getAccessToken;
