import type { APIGatewayProxyHandler } from "aws-lambda";
import emailError from "./emailError.server";

type Logic<T, U> = (e: T) => string | U | Promise<U | string>;

const createAPIGatewayProxyHandler =
  <T extends Record<string, unknown>, U extends Record<string, unknown>>(
    args:
      | Logic<T, U>
      | { logic: Logic<T, U>; allowedOrigins?: (string | RegExp)[] }
  ): APIGatewayProxyHandler =>
  (event, context) => {
    const allowedOrigins = (
      typeof args === "function" ? [] : args.allowedOrigins || []
    ).map((s) => (typeof s === "string" ? new RegExp(s) : s));
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
    return new Promise<U | string>((resolve, reject) => {
      try {
        const logic = typeof args === "function" ? args : args.logic;
        resolve(
          logic({
            ...(event.requestContext.authorizer || {}),
            requestId: context.awsRequestId,
            ...(event.queryStringParameters || {}),
            ...JSON.parse(event.body || "{}"),
          })
        );
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
        console.error(e);
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
          ? emailError(e.name, e).then((id) => ({
              statusCode,
              body: `Unknown error - Message Id ${id}`,
              headers,
            }))
          : userResponse;
      });
  };

export default createAPIGatewayProxyHandler;
