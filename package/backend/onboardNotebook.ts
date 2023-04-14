import { Lambda } from "@aws-sdk/client-lambda";
import { OnboardNotebookPayload, zOnboardNotebookResponse } from "./types";

const lambda = new Lambda({ endpoint: process.env.AWS_ENDPOINT });

const onboardNotebook = (payload: OnboardNotebookPayload) => {
  return lambda
    .invoke({
      FunctionName: "samepage-network_onboard",
      Payload: Buffer.from(JSON.stringify(payload)),
    })
    .then((res) => {
      const payload = Buffer.from(res.Payload ?? []).toString() || "{}";
      if (res.FunctionError) {
        throw new Error(payload);
      }
      return zOnboardNotebookResponse.parse(JSON.parse(payload));
    });
};

export default onboardNotebook;
