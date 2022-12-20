import { Lambda } from "@aws-sdk/client-lambda";
import { domain } from "@dvargas92495/app/backend/constants.server";
import axios from "axios";
import { v4 } from "uuid";
import { handler as uploadToIpfs } from "../../api/upload-to-ipfs";
// import { spawn } from "child_process";
// import fs from "fs";

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
      }) => {
        // TODO: we might actually want this done in a child process
        return path === "upload-to-ipfs"
          ? // @ts-ignore
            uploadToIpfs({...data, dry: true}, { awsRequestId: v4() }).then(() => true)
          : Promise.reject(new Error(`Unknown path: ${path}`));
        // const requestId = v4();
        // const dataPath = `/tmp/${requestId}.json`;
        // fs.writeFileSync(dataPath, JSON.stringify(data));
        // spawn(`ts-node`, [`api/${path}.ts`, requestId], {
        //   stdio: "inherit",
        //   env: process.env,
        // });
        // return true;
      }
    : <T extends Record<string, unknown>>({
        path,
        data,
      }: {
        path: string;
        data: T;
      }) => axios.post(`${process.env.API_URL}/${path}`, data).then(() => true);

export default invokeAsync;
