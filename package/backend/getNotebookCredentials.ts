import { InvokeCommandOutput, Lambda } from "@aws-sdk/client-lambda";
import ServerError from "package/utils/ServerError";
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
        throw new ServerError(payload, res.$metadata.httpStatusCode || 500);
      }
      return zGetNotebookCredentialsResponse.parse(JSON.parse(payload));
    })
    .catch((err) => {
      console.log(err);
      const res = err as InvokeCommandOutput;
      return Promise.reject(
        new ServerError(
          res.FunctionError || "Server Error",
          res.$metadata.httpStatusCode || 500
        )
      );
    });
};

export default getNotebookCredentials;
