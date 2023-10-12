import createAPIGatewayProxyHandler from "./createAPIGatewayProxyHandler";

const createPublicAPIGatewayProxyHandler: typeof createAPIGatewayProxyHandler =
  (args) =>
    createAPIGatewayProxyHandler({
      ...(typeof args === "function" ? { logic: args } : args),
      allowedOrigins: [/.*/],
    });

export default createPublicAPIGatewayProxyHandler;
