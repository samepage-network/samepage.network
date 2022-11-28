import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

const getApi = (): ApiGatewayManagementApi =>
  new ApiGatewayManagementApi({
    endpoint: `https://${process.env.API_GATEWAY_ID}.execute-api.us-east-1.amazonaws.com/production`,
  });

export default getApi;
