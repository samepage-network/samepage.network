import { Lambda } from "@aws-sdk/client-lambda";
import { domain } from "@dvargas92495/app/backend/constants.server";
import axios from "axios";
import { v4 } from "uuid";

const lambda = new Lambda({ region: process.env.AWS_REGION });

const invokeAsync =
  process.env.NODE_ENV === "production"
    ? <T extends Record<string, unknown>>({
        path,
        data,
      }: {
        path: string;
        data: T;
      }) =>
        lambda
          .invoke({
            FunctionName: `${domain.replace(/\./g, "-")}_${path}`,
            InvocationType: "Event",
            Payload: Buffer.from(JSON.stringify(data)),
          })
          .then(() => true)
    : process.env.NODE_ENV === "test"
    ? <T extends Record<string, unknown>>({
        path,
        data,
      }: {
        path: string;
        data: T;
      }) =>
        // TODO: we might actually want this done in a child process
        path === "upload-to-ipfs"
          ? import(`../../api/upload-to-ipfs`)
              // @ts-ignore
              .then((mod) => mod.handler(data, { awsRequestId: v4() }))
              .then(() => true)
          : Promise.reject(new Error(`Unknown path: ${path}`))
    : <T extends Record<string, unknown>>({
        path,
        data,
      }: {
        path: string;
        data: T;
      }) => axios.post(`${process.env.API_URL}/${path}`, data).then(() => true);

export default invokeAsync;
