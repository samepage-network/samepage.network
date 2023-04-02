import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";

const logic = ({
  name,
  requestId,
  ...Payload
}: {
  name: string;
  requestId: string;
  Payload: string;
}) => {
  const fileName = name.replace(/^samepage-network_/, "");
  const rand = Math.random();
  return import(`${process.cwd()}/build/${fileName}.js?bust=${rand}`)
    .then((module) => {
      return module.handler(Payload, { awsRequestId: requestId });
    })
    .then((response) => {
      return {
        Payload: JSON.stringify(response),
      };
    })
    .catch((e) => {
      // TODO: One issue is that we are not being caught in the `FunctionError` param
      // of invoke, and instead are triggering invoke().catch() 
      return Promise.reject(
        new Error(JSON.stringify({ message: e.message, stack: e.stack }))
      );
    });
};

export default createAPIGatewayProxyHandler(logic);
