import { APIGatewayProxyHandler } from "aws-lambda";
import nodepath from "path";
import os from "os";

export const handler: APIGatewayProxyHandler = async (event, context) => {
  const { id = "", file = "" } = event.pathParameters || {};
  const { external, job } = event.queryStringParameters || {};
  event.pathParameters = {};
  const filePath = nodepath.join(
    external ? id : `${id}-samepage`,
    "out",
    ...(job ? [`${file}.js`] : [file, "post.js"])
  );
  Object.keys(require.cache)
    .filter((k) => k.endsWith(filePath))
    .forEach((k) => {
      delete require.cache[k];
    });
  const rand = Math.random();
  const fullPath = `${nodepath.join(
    process.cwd(),
    "..",
    filePath
  )}?bust=${rand}`;
  const normalizedPath =
    os.platform() === "win32" ? `file://${fullPath.normalize()}` : fullPath;
  return import(normalizedPath)
    .then((module) => {
      if (!job) return module.handler(event, context);
      else module.handler(JSON.parse(event.body || "{}"));
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      };
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }));
};
