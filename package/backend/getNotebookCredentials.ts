import { Lambda } from "@aws-sdk/client-lambda";
import {
  GetNotebookCredentialsPayload,
  zGetNotebookCredentialsResponse,
} from "./types";

const lambda = new Lambda({ endpoint: process.env.AWS_ENDPOINT });

const getNotebookCredentials = (payload: GetNotebookCredentialsPayload) => {
  return lambda
    .invoke({
      FunctionName: "samepage-network_notebook",
      Payload: Buffer.from(JSON.stringify(payload)),
    })
    .then((res) => {
      const payload = Buffer.from(res.Payload ?? []).toString() || "{}";
      if (res.FunctionError) {
        throw new Error(payload);
      }
      return zGetNotebookCredentialsResponse.parse(JSON.parse(payload));
    });
};

export default getNotebookCredentials;
