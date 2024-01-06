import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";

const logic = (data: unknown) => {
  console.log(data);
  return {
    statusCode: 200,
    body: JSON.stringify({ data }),
  };
};

export const handler = createAPIGatewayProxyHandler({
  logic,
});
