import { z } from "zod";
import { DataFunctionArgs } from "@remix-run/node";
import { v4 } from "uuid";

const parseRemixContext = (context: DataFunctionArgs["context"]) => {
  return z
    .object({
      lambdaContext: z
        .object({
          invokedFunctionArn: z.string().default(""),
          logGroupName: z.string().default(""),
          logStreamName: z.string().default(""),
          awsRequestId: z.string().default(v4()),
        })
        .default({}),
    })
    .default({})
    .parse(context);
};

export default parseRemixContext;
