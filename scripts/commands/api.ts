import express from "express";
import type { APIGatewayProxyHandler, Context, Handler } from "aws-lambda";
import addSeconds from "date-fns/addSeconds";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import format from "date-fns/format";
import { v4 } from "uuid";
import ngrok from "ngrok";
import esbuild from "esbuild";
import WebSocket, { Server as WebSocketServer } from "ws";
import readDir from "../../package/scripts/internal/readDir";
import appPath from "../../package/scripts/internal/appPath";
import { getOpts } from "../../package/scripts/internal/nodeCompile";
import debugMod from "../../package/utils/debugger";
import fs from "fs";
import crypto from "crypto";
import { qsToJson } from "../../package/backend/createAPIGatewayProxyHandler";
import * as dirPath from "path";

const debug = debugMod("api");
const METHODS = ["get", "post", "put", "delete", "options"] as const;
const METHOD_SET = new Set<string>(METHODS);
type ExpressMethod = (typeof METHODS)[number];
const generateContext = ({
  functionName,
  executionTimeStarted,
}: {
  functionName: string;
  executionTimeStarted: Date;
}): Context => {
  const executionTimeout = addSeconds(executionTimeStarted, 10);
  return {
    awsRequestId: v4(),
    callbackWaitsForEmptyEventLoop: true,
    clientContext: undefined,
    functionName,
    functionVersion: `$LATEST`,
    identity: undefined,
    invokedFunctionArn: `offline_invokedFunctionArn_for_${functionName}`,
    logGroupName: `offline_logGroupName_for_${functionName}`,
    logStreamName: `offline_logStreamName_for_${functionName}`,
    memoryLimitInMB: String(128),
    getRemainingTimeInMillis: () => {
      const timeLeft = differenceInMilliseconds(executionTimeout, new Date());
      return timeLeft > 0 ? timeLeft : 0;
    },
    // these three are deprecated
    done: () => ({}),
    fail: () => ({}),
    succeed: () => ({}),
  };
};
const fileHashes: { [key: string]: string } = {};
const optionRoutes = new Set();
const localSockets: Record<string, WebSocket> = {};
const addLocalSocket = (id: string, ws: WebSocket): void => {
  localSockets[id] = ws;
};

const removeLocalSocket = (id: string): void => {
  if (
    localSockets[id]?.readyState === WebSocket.OPEN ||
    localSockets[id]?.readyState === WebSocket.CONNECTING
  ) {
    localSockets[id].close();
  }
  delete localSockets[id];
};

const inlineTryCatch = <T>(tryFcn: () => T, catchFcn: (e: Error) => T): T => {
  try {
    return tryFcn();
  } catch (e) {
    return catchFcn(e as Error);
  }
};

const path = "api";
const out = "build";

const api = async ({ local }: { local?: boolean } = {}): Promise<number> => {
  process.env.NODE_ENV = process.env.NODE_ENV || "development";
  process.env.AWS_ENDPOINT =
    process.env.AWS_ENDPOINT || "http://localhost:3003/mocks/aws";

  const entryRegex = new RegExp(
    `^${path}[\\\\/]((ws[/\\\\][a-z0-9-]+)|(\\$?[a-z0-9-]+[/\\\\])*(get|post|put|delete|[a-z]+)|[a-z0-9-]+)\\.[tj]s$`
  );
  const wsRegex = new RegExp(`^${path}[\\\\/]ws[/\\\\][a-z0-9-]+\\.[tj]s$`);
  debug(
    "Preparing the API build from",
    path,
    "in",
    process.env.NODE_ENV,
    "mode..."
  );
  const app = express();
  app.use(function (req, _, next) {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", function (chunk) {
      data += chunk;
    });
    req.on("end", function () {
      req.body = data;
      next();
    });
  });
  const entries = readDir(path).filter((f) => entryRegex.test(f));
  const rebuildCallback = async (file: string) => {
    const filePath = appPath(
      file.replace(new RegExp(`^${path}`), out).replace(/\.ts$/, ".js")
    );
    const loadHandler = <T = Handler>() => {
      const hash = crypto
        .createHash("sha256")
        .update(fs.readFileSync(filePath))
        .digest("hex");
      if (fileHashes[filePath] !== hash) {
        Object.keys(require.cache)
          .filter((k) => k.includes(filePath))
          .forEach((k) => delete require.cache[k]);
        fileHashes[filePath] = hash;
      }
      return require(filePath).handler as T;
    };
    const functionName = file
      .replace(new RegExp(`^${path}[\\\\/]`), "")
      .replace(/\.[tj]s$/, "");
    const paths = functionName.split(/[\\\\/]/);
    if (paths[0] === "ws") {
      // TODO: Rebuild websocket routes
    } else {
      const method = paths.slice(-1)[0].toLowerCase() as ExpressMethod;
      const route = `/${
        METHOD_SET.has(method) ? paths.slice(0, -1).join("/") : paths.join("/")
      }`.replace(/\$/g, ":");
      if (METHOD_SET.has(method)) {
        // Mock API Gateway
        app[method](route, (req, res) => {
          debug(`Received Request ${method} ${req.path}`);
          const handler = loadHandler<APIGatewayProxyHandler>();

          if (typeof handler !== "function") {
            return res
              .header("Content-Type", "application/json")
              .status(502)
              .json({
                errorMessage: `Could not find function handler for ${functionName}`,
                errorType: "HANDLER_NOT_FOUND",
              });
          }
          const { headers, body: _body, params, url, ip } = req;
          const searchParams = Array.from(
            new URL(url || "", "http://example.com").searchParams.entries()
          );
          const executionTimeStarted = new Date();
          const simpleHeaders = Object.fromEntries(
            Object.entries(headers).map(([h, v]) => [
              h,
              typeof v === "object" ? v[0] : v,
            ])
          );
          const body =
            simpleHeaders["content-type"] ===
            "application/x-www-form-urlencoded"
              ? JSON.stringify(qsToJson(_body))
              : _body;
          const event = {
            body,
            headers: simpleHeaders,
            httpMethod: method,
            isBase64Encoded: false, // TODO hook up
            multiValueHeaders: Object.fromEntries(
              Object.entries(headers).map(([h, v]) => [
                h,
                typeof v === "string" ? [v] : v,
              ])
            ),
            multiValueQueryStringParameters: searchParams.reduce(
              (prev, [k, v]) => {
                if (prev[k]) {
                  prev[k].push(v);
                } else {
                  prev[k] = [v];
                }
                return prev;
              },
              {} as { [k: string]: string[] }
            ),
            path: route,
            pathParameters: Object.keys(params).length ? params : null,
            queryStringParameters: Object.fromEntries(searchParams),
            requestContext: {
              accountId: "offlineContext_accountId",
              apiId: "offlineContext_apiId",
              authorizer: {},
              domainName: "offlineContext_domainName",
              domainPrefix: "offlineContext_domainPrefix",
              extendedRequestId: v4(),
              httpMethod: method,
              identity: {
                accessKey: null,
                accountId:
                  process.env.SLS_ACCOUNT_ID || "offlineContext_accountId",
                apiKey: process.env.SLS_API_KEY || "offlineContext_apiKey",
                apiKeyId:
                  process.env.SLS_API_KEY_ID || "offlineContext_apiKeyId",
                caller: process.env.SLS_CALLER || "offlineContext_caller",
                clientCert: null,
                cognitoAuthenticationProvider:
                  simpleHeaders["cognito-authentication-provider"] ||
                  process.env.SLS_COGNITO_AUTHENTICATION_PROVIDER ||
                  "offlineContext_cognitoAuthenticationProvider",
                cognitoAuthenticationType:
                  process.env.SLS_COGNITO_AUTHENTICATION_TYPE ||
                  "offlineContext_cognitoAuthenticationType",
                cognitoIdentityId:
                  simpleHeaders["cognito-identity-id"] ||
                  process.env.SLS_COGNITO_IDENTITY_ID ||
                  "offlineContext_cognitoIdentityId",
                cognitoIdentityPoolId:
                  process.env.SLS_COGNITO_IDENTITY_POOL_ID ||
                  "offlineContext_cognitoIdentityPoolId",
                principalOrgId: null,
                sourceIp: ip,
                user: "offlineContext_user",
                userAgent: simpleHeaders["user-agent"] || "",
                userArn: "offlineContext_userArn",
              },
              path: route,
              protocol: "HTTP/1.1",
              requestId: v4(),
              requestTime: format(
                executionTimeStarted,
                "dd/MMM/yyyy:HH:mm:ss zzz"
              ),
              requestTimeEpoch: executionTimeStarted.valueOf(),
              resourceId: "offlineContext_resourceId",
              resourcePath: route,
              stage: "dev",
            },
            resource: route,
            stageVariables: null,
          };
          const context = generateContext({
            functionName,
            executionTimeStarted,
          });

          const result = handler(event, context, () => ({}));
          return Promise.resolve(result || undefined)
            .then((result) => {
              const executionTime = differenceInMilliseconds(
                new Date(),
                executionTimeStarted
              );
              debug(`Executed ${method} ${req.path} in ${executionTime}ms`);
              return result;
            })
            .then((result) => {
              if (!result || typeof result.body !== "string") {
                return res
                  .header("Content-Type", "application/json")
                  .status(502)
                  .json({
                    errorMessage: "Invalid body returned",
                    errorType: "INVALID_BODY",
                  });
              }
              Object.entries(result.headers || {}).forEach(([k, v]) =>
                res.append(k, v.toString())
              );
              Object.entries(result.multiValueHeaders || {}).forEach(
                ([k, vs]) => vs.forEach((v) => res.append(k, v.toString()))
              );
              res.status(result.statusCode || 200);
              return result.isBase64Encoded
                ? res
                    .setDefaultEncoding("binary")
                    .send(Buffer.from(result.body, "base64"))
                : inlineTryCatch(
                    () => res.json(JSON.parse(result.body)),
                    () => res.send(result.body)
                  );
            })
            .catch((error: Error) => {
              const message = error.message || error.toString();
              console.error(message, "\n", error);
              return res
                .header("Content-Type", "application/json")
                .status(502)
                .json({
                  errorMessage: message,
                  errorType: error.constructor.name,
                  stackTrace: (error.stack || "")
                    .split("\n")
                    .map((l) => l.trim()),
                });
            });
        });
        if (method === "options") {
          optionRoutes.add(route);
        }
      } else {
        // Mock Lambda
        app.post(route, (req, res) => {
          const invocationType =
            req.headers["x-amz-invocation-type"] || "Event";
          debug(`Received Request ${invocationType} ${req.path}`);
          const handler = loadHandler<Handler>();
          if (typeof handler !== "function") {
            return res
              .header("Content-Type", "application/json")
              .status(502)
              .json({
                errorMessage: `Could not find function handler for ${functionName}`,
                errorType: "HANDLER_NOT_FOUND",
              });
          }
          const event = JSON.parse(req.body);
          event.pathParameters = Object.keys(req.params).length
            ? req.params
            : null;
          const executionTimeStarted = new Date();
          const context = generateContext({
            functionName,
            executionTimeStarted,
          });
          if (invocationType === "Event") {
            new Promise((resolve) =>
              setTimeout(() => resolve(handler(event, context, () => ({}))), 1)
            )
              .then(() => {
                const executionTime = differenceInMilliseconds(
                  new Date(),
                  executionTimeStarted
                );
                debug(`Executed async ${functionName} in ${executionTime}ms`);
              })
              .catch((error: Error) => {
                const message = error.message || error.toString();
                console.error(message, "\n", error);
              });
            return res.status(202).json({});
          } else {
            const result = handler(event, context, () => ({}));
            return Promise.resolve(result || undefined)
              .then((result) => {
                const executionTime = differenceInMilliseconds(
                  new Date(),
                  executionTimeStarted
                );
                debug(`Executed ${method} ${req.path} in ${executionTime}ms`);
                res.status(200);
                return inlineTryCatch(
                  () => res.json(JSON.parse(result)),
                  () => res.send(result)
                );
              })
              .catch((error: Error & { code?: number }) => {
                const message = error.message || error.toString();
                console.error(message, "\n", error);
                return res
                  .header("x-amzn-errortype", "InvalidRuntimeException")
                  .header("Content-Type", "application/json")
                  .status(error.code || 502)
                  .json({
                    errorMessage: message,
                    errorType: error.constructor.name,
                    stackTrace: (error.stack || "")
                      .split("\n")
                      .map((l) => l.trim()),
                  });
              });
          }
        });
      }
      debug(
        `Added Route ${
          METHOD_SET.has(method) ? method.toUpperCase() : "POST"
        } ${route}`
      );
      if (!optionRoutes.has(route)) {
        app.options(route, (req, res) =>
          res
            .status(200)
            .header(
              "Access-Control-Allow-Headers",
              req.headers["access-control-request-headers"]
            )
            .header("Access-Control-Allow-Origin", req.headers["origin"])
            .header(
              "Access-Control-Allow-Methods",
              req.headers["access-control-request-method"]
            )
            .send()
        );
      }
    }
  };
  await esbuild
    .context(
      getOpts({
        functions: entries.map((file) =>
          file.replace(/^api\//, "").replace(/\.ts$/, "")
        ),
      })
    )
    .then((b) => b.watch())
    .then(() =>
      Promise.all(
        entries
          .sort((a, b) => {
            const dynamicA = a.split("$").length - 1;
            const dynamicB = b.split("$").length - 1;
            return dynamicA - dynamicB || a.localeCompare(b);
          })
          .map(rebuildCallback)
      )
    );
  const port = 3003;
  const wsEntries = entries
    .filter((f) => wsRegex.test(f))
    .map((f) =>
      appPath(f.replace(new RegExp(`^${path}`), out).replace(/\.[tj]s$/, ""))
    );
  // TODO - move this to chokidar loop above somehow
  if (wsEntries.length) {
    app.post("/ws", (req, res) => {
      const { ConnectionId, Data } = JSON.parse(req.body);
      const connection = localSockets[ConnectionId];
      if (!connection) {
        res.json({ success: false });
        return;
      }
      connection.send(Data, (err) => {
        res.json({ success: !err });
      });
    });
  }
  app.use((req, res) => {
    console.error(`Route not found: ${req.method} - ${req.path}`);
    res
      .header("Access-Control-Allow-Origin", "*")
      .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
      .status(404)
      .json({
        currentRoute: `${req.method} - ${req.path}`,
        error: "Route not found.",
        statusCode: 404,
      });
  });
  const appServer = app.listen(port, () => {
    console.log(`API server listening on port ${port}...`);
    if (!local)
      ngrok
        .connect({
          addr: port,
          subdomain: "api.samepage",
        })
        .then((url) => {
          debug("Started local ngrok tunneling:");
          debug(url);
          return 0;
        });
  });
  const startWebSocketServer = () => {
    const wss = new WebSocketServer({ server: appServer });
    wss.on("connection", (ws) => {
      const connectionId = v4();
      debug("new ws connection", connectionId);
      // const messageHandlers = wsEntries.filter(
      //   (w) =>
      //     !/onconnect$/.test(w) &&
      //     !/ondisconnect$/.test(w)
      // );
      ws.on("message", (data) => {
        debug("new message from", connectionId);
        const body = data.toString();
        const action = JSON.parse(body).action;
        const filePath = wsEntries.find((f) =>
          f.endsWith(dirPath.join("ws", action))
        );
        if (filePath) {
          import(filePath).then(({ handler }) => {
            delete require.cache[filePath];
            handler(
              {
                body,
                requestContext: { connectionId },
              },
              { awsRequestId: v4() }
            );
          });
        }
      });
      ws.on("close", (a: number, b: Buffer) => {
        debug("client closing...", a, b.toString());
        removeLocalSocket(connectionId);
        const filePath = wsEntries.find((f) =>
          f.endsWith(dirPath.join("ws", "ondisconnect"))
        );
        if (filePath) {
          import(filePath).then(({ handler }) => {
            delete require.cache[filePath];
            handler(
              {
                requestContext: { connectionId },
                body: JSON.stringify([a, b]),
              },
              { awsRequestId: v4() }
            );
          });
        }
      });
      addLocalSocket(connectionId, ws);
      const filePath = wsEntries.find((f) =>
        f.endsWith(dirPath.join("ws", "onconnect"))
      );
      if (filePath) {
        import(filePath).then(({ handler }) => {
          delete require.cache[filePath];
          handler(
            { requestContext: { connectionId }, body: "" },
            { awsRequestId: v4() }
          );
        });
      }
    });
    return () =>
      new Promise<void>((innerResolve) => {
        wss.on("close", innerResolve);
        wss.close();
      });
  };
  const closeWsServer = wsEntries.length
    ? startWebSocketServer()
    : Promise.resolve;
  return new Promise((resolve) => {
    const close = () =>
      Promise.all([
        new Promise((innerResolve) => {
          appServer.on("close", innerResolve);
          appServer.close();
        }),
        closeWsServer(),
      ]).then(() => resolve(0));
    process.on("exit", close);
    process.on("SIGINT", close);
    process.on("uncaughtException", (e) => {
      console.error("Uncaught Exception in API!");
      console.error(e);
    });
  });
};

export default api;
