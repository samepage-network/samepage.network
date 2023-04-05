import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";

const logic = ({ name, ...Payload }: { name: string }) => {
  const fileName = name.replace(/^samepage-network_/, "").replace(/-/g, "/");
  return fetch(`${process.env.API_URL}/${fileName}`, {
    method: "POST",
    body: JSON.stringify(Payload),
  })
    .then((r) => r.json())
    .catch((e) => {
      // TODO: One issue is that we are not being caught in the `FunctionError` param
      // of invoke, and instead are triggering invoke().catch()
      return Promise.reject(
        new Error(JSON.stringify({ message: e.message, stack: e.stack }))
      );
    });
};

export default createAPIGatewayProxyHandler(logic);
