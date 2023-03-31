import { APIGatewayProxyHandler } from "aws-lambda";
import fs from "fs";
import nodeCompile from "package/scripts/internal/nodeCompile";
import dotenv from "dotenv";

export const handler: APIGatewayProxyHandler = async (event, context) => {
  const { id = "", file = "" } = event.pathParameters || {};
  event.pathParameters = {};
  const root = `${process.cwd()}/../${id}-samepage`;
  const outdir = `${root}/out`;
  Object.keys(require.cache)
    .filter((k) => k.endsWith(`${id}-samepage/out/${file}.js`))
    .forEach((k) => {
      delete require.cache[k];
    });
  // todo: build this in the extension repos
  await nodeCompile({
    outdir,
    functions: [file],
    root: `${root}/src/functions`,
    define: Object.fromEntries(
      Object.entries(dotenv.parse(fs.readFileSync(`${root}/.env`))).map(
        ([k, v]) => [`process.env.${k}`, JSON.stringify(v)]
      )
    ),
  });
  const rand = Math.random();
  return import(`${outdir}/${file}.js?bust=${rand}`).then((module) => {
    return module.handler(event, context);
  });
};
