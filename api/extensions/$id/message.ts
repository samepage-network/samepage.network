import { Handler } from "aws-lambda";

export const handler: Handler = async (event, context) => {
  const { id = "" } = event.pathParameters || {};
  event.pathParameters = {};
  Object.keys(require.cache)
    .filter((k) => k.endsWith(`${id}-samepage/out/message.js`))
    .forEach((k) => {
      delete require.cache[k];
    });
  const rand = Math.random();
  return import(
    `${process.cwd()}/../${id}-samepage/out/message.js?bust=${rand}`
  )
    .then((module) => {
      return module.handler(event, context);
    })
    .catch((e) => ({
      statusCode: 500,
      body: e.message,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }));
};
