import type {
  APIGatewayProxyHandler,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
} from "aws-lambda";
import emailError from "./emailError.server";
import qs from "querystring";
import xmljs from "xml-js";
import ServerError from "./ServerError";
import { BackendRequest } from "../internal/types";
import parseZodError from "../utils/parseZodError";
import { ZodError, ZodType, z } from "zod";

type Logic<T extends ZodType<any, any, any>, U> = (
  e: BackendRequest<T>
) => string | U | Promise<U | string>;

export const qsToJson = (q: string) => {
  const parsed = qs.parse(q) as Record<string, unknown>;
  const flattenObj = (r: Record<string, unknown>) => {
    Object.entries(r).forEach(([k, v]) => {
      const keyParts = k.split(".");
      if (keyParts.length > 1) {
        const [first, ...rest] = keyParts;
        const firstVal = r[first];
        const existing = typeof firstVal === "object" ? firstVal : {};
        r[first] = flattenObj({
          ...existing,
          [rest.join(".")]: v,
        });
        delete r[k];
        flattenObj(r[first] as Record<string, unknown>);
      }
    });
    return r;
  };
  return flattenObj(parsed);
};

const createAPIGatewayProxyHandler =
  <T extends ZodType<any, any, any>, U extends Record<string, unknown>>(
    args:
      | Logic<z.infer<T>, U>
      | {
          logic: Logic<z.infer<T>, U>;
          allowedOrigins?: (string | RegExp)[];
          bodySchema?: { parse: (s: string) => z.infer<T> };
          includeHeaders?: string[];
          validate?: (args: {
            body: string | null;
            headers: APIGatewayProxyEventHeaders;
          }) => boolean;
        }
  ): APIGatewayProxyHandler =>
  async (event, context): Promise<APIGatewayProxyResult> => {
    const allowedOrigins = (
      typeof args === "function" ? [] : args.allowedOrigins || []
    ).map((s) => (typeof s === "string" ? new RegExp(s) : s));
    const bodySchema = typeof args === "function" ? undefined : args.bodySchema;
    const includeHeaders =
      typeof args === "function"
        ? new Set<string>()
        : new Set(args.includeHeaders || []);
    const requestOrigin = event.headers.origin || event.headers.Origin || "";
    const cors = allowedOrigins.some((r) => r.test(requestOrigin))
      ? requestOrigin
      : process.env.ORIGIN || "*";
    const validate = typeof args === "function" ? undefined : args.validate;
    const makeResponseHeaders = (responseHeaders: unknown) => ({
      "Access-Control-Allow-Origin": cors,
      ...(typeof responseHeaders === "object" && responseHeaders
        ? Object.fromEntries(
            Object.entries(responseHeaders).filter(
              ([h]) => !/access-control-allow-origin/i.test(h)
            )
          )
        : {}),
    });
    const requestId = context.awsRequestId;
    return new Promise<U | string>((resolve, reject) => {
      try {
        if (validate && !validate(event)) {
          reject(new ServerError("Request Body Failed Validation", 400));
          return;
        }
        const authorization =
          event.headers.Authorization || event.headers.authorization;
        const logic = typeof args === "function" ? args : args.logic;
        const eventBody = !event.body
          ? {}
          : event.headers["content-type"] === "application/www-form-urlencoded"
          ? qsToJson(event.body)
          : JSON.parse(event.body);
        const rawObject = {
          ...event.pathParameters,
          ...(event.queryStringParameters || {}),
          ...eventBody,
          ...Object.fromEntries(
            Object.entries(event.headers).filter(([h]) => includeHeaders.has(h))
          ),
        };
        const body = bodySchema ? bodySchema.parse(rawObject) : rawObject;
        resolve(
          logic({
            ...(event.requestContext.authorizer || {}),
            ...(authorization ? { authorization } : {}),
            requestId,
            ...body,
          })
        );
      } catch (e) {
        reject(e);
      }
    })
      .then(async (response) => {
        if (typeof response === "object") {
          const { headers, code, ...res } = response;

          const statusCode =
            typeof code === "number" && code >= 200 && code < 400 ? code : 200;
          const contentType =
            typeof headers === "object" &&
            headers !== null &&
            typeof (headers as Record<string, unknown>)["Content-Type"] ===
              "string"
              ? (headers as Record<string, string>)["Content-Type"]
              : "application/json";
          return {
            statusCode,
            body:
              contentType === "text/xml"
                ? xmljs.js2xml(res, { compact: true, spaces: 2 })
                : JSON.stringify(res),
            headers: makeResponseHeaders(headers),
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
      .catch(async (e) => {
        const headers = makeResponseHeaders(e.headers);
        if (e instanceof ZodError) {
          return {
            statusCode: 400,
            body: parseZodError(e),
            headers,
          };
        }

        const statusCode =
          typeof e.code === "number" && e.code >= 400 && e.code < 600
            ? e.code
            : 500;
        if (statusCode >= 400 && statusCode < 500) {
          return {
            statusCode,
            body: e.message,
            headers,
          };
        }

        if (
          typeof e.name === "string" &&
          e.name &&
          process.env.NODE_ENV === "production"
        ) {
          const emailId = await emailError(
            `API Gateway Error (${e.name})`,
            e,
            JSON.stringify({ context, body: event.body })
          );
          return {
            statusCode,
            body: `Unknown error - Message Id ${emailId}`,
            headers,
          };
        }

        return {
          statusCode,
          body: e.stack,
          headers,
        };
      });
  };

export default createAPIGatewayProxyHandler;
