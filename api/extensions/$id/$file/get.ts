import { APIGatewayProxyHandler } from "aws-lambda";

export const handler: APIGatewayProxyHandler = async (event, context) => {
  const { id = "", file = "" } = event.pathParameters || {};
  event.pathParameters = {};
  Object.keys(require.cache)
    .filter((k) => k.endsWith(`${id}-samepage/out/${file}/get.js`))
    .forEach((k) => {
      delete require.cache[k];
    });
  const rand = Math.random();
  return import(
    `${process.cwd()}/../${id}-samepage/out/${file}/get.js?bust=${rand}`
  ).then((module) => {
    return module.handler(event, context);
  });
};
