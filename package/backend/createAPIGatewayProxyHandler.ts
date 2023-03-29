import type { APIGatewayProxyHandler } from "aws-lambda";
import emailError from "./emailError.server";
import type { ZodSchema } from "zod";

type Logic<T, U> = (e: T) => string | U | Promise<U | string>;

const defaultRunAuthorizer = async ({
  authorization,
}: {
  authorization: string;
}) => ({
  authorization,
});

const createAPIGatewayProxyHandler =
  <T extends Record<string, unknown>, U extends Record<string, unknown>>(
    args:
      | Logic<T, U>
      | {
          logic: Logic<T, U>;
          allowedOrigins?: (string | RegExp)[];
          bodySchema?: ZodSchema;
          runAuthorizer?: (e: {
            authorization: string;
            requestId: string;
          }) => Promise<Record<string, string>>;
        }
  ): APIGatewayProxyHandler =>
  (event, context) => {
    const allowedOrigins = (
      typeof args === "function" ? [] : args.allowedOrigins || []
    ).map((s) => (typeof s === "string" ? new RegExp(s) : s));
    const bodySchema = typeof args === "function" ? undefined : args.bodySchema;
    const runAuthorizer =
      typeof args === "function" ? defaultRunAuthorizer : args.runAuthorizer || defaultRunAuthorizer;
    const requestOrigin = event.headers.origin || event.headers.Origin || "";
    const cors = allowedOrigins.some((r) => r.test(requestOrigin))
      ? requestOrigin
      : process.env.ORIGIN || "*";
    const getHeaders = (responseHeaders: unknown) => ({
      "Access-Control-Allow-Origin": cors,
      ...(typeof responseHeaders === "object" && responseHeaders
        ? Object.fromEntries(
            Object.entries(responseHeaders).filter(
              ([h]) => !/access-control-allow-origin/i.test(h)
            )
          )
        : {}),
    });
    return new Promise<U | string>(async (resolve, reject) => {
      try {
        const requestId = context.awsRequestId;
        const authorization =
          event.headers.Authorization || event.headers.authorization;
        const authorizer = authorization
          ? await runAuthorizer({ requestId, authorization }).catch(() => ({}))
          : {};
        const logic = typeof args === "function" ? args : args.logic;
        const rawObject = {
          ...(event.requestContext.authorizer || authorizer),
          requestId,
          ...event.pathParameters,
          ...(event.queryStringParameters || {}),
          ...JSON.parse(event.body || "{}"),
        };
        const body = bodySchema ? bodySchema.parse(rawObject) : rawObject;
        resolve(logic(body));
      } catch (e) {
        reject(e);
      }
    })
      .then((response) => {
        if (typeof response === "object") {
          const { headers, code, ...res } = response;

          const statusCode =
            typeof code === "number" && code >= 200 && code < 400 ? code : 200;
          return {
            statusCode,
            body: JSON.stringify(res),
            headers: getHeaders(headers),
          };
        } else {
          return {
            statusCode: 200,
            body: response,
            headers: {
              "Access-Control-Allow-Origin": cors,
            },
          };
        }
      })
      .catch((e) => {
        const statusCode =
          typeof e.code === "number" && e.code >= 400 && e.code < 600
            ? e.code
            : 500;
        const headers = getHeaders(e.headers);
        const userResponse = {
          statusCode,
          body: e.message,
          headers,
        };
        if (statusCode >= 400 && statusCode < 500) {
          return userResponse;
        }
        return typeof e.name === "string" &&
          e.name &&
          process.env.NODE_ENV === "production"
          ? emailError(
              `API Gateway Error (${e.name})`,
              e,
              JSON.stringify(context)
            ).then((id) => ({
              statusCode,
              body: `Unknown error - Message Id ${id}`,
              headers,
            }))
          : userResponse;
      });
  };

export default createAPIGatewayProxyHandler;
