import { createRequestHandler } from "remix-lambda-at-edge";

export const handler = createRequestHandler({
  getBuild: () => require("./build"),
  originPaths: [/^\/build\/.+/, /^\/landing\/(manrope\.ttf|OFL\.txt)$/],
  onError: (error) => console.error(error),
});
