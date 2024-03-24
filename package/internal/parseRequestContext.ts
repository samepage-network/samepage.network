import { z } from "zod";
import { LoaderFunctionArgs } from "react-router-dom";
import { v4 } from "uuid";

const parseRequestContext = (context: LoaderFunctionArgs["context"]) => {
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
      requestId: z.string().default(v4()),
      paused: z.boolean().default(true),
    })
    .default({})
    .transform(
      ({
        lambdaContext: { awsRequestId, ...lambdaContext },
        requestId,
        ...rest
      }) => ({
        requestId: requestId || awsRequestId,
        ...lambdaContext,
        ...rest,
      })
    )
    .parse(context);
};

export default parseRequestContext;
