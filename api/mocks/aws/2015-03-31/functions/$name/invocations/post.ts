import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import ServerError from "package/backend/ServerError";

const logic = ({ name, ...Payload }: { name: string }) => {
  const fileName = name.replace(/^samepage-network_/, "").replace(/-/g, "/");
  return fetch(`${process.env.API_URL}/${fileName}`, {
    method: "POST",
    body: JSON.stringify(Payload),
    headers: {
      "x-amz-invocation-type": "RequestResponse",
    },
  }).then(async (r) => {
    if (!r.ok) {
      throw new ServerError(
        JSON.stringify({
          FunctionError: r.statusText,
          Payload: await r.text(),
          code: "InvalidRuntimeException",
        }),
        r.status
      );
    }
    return r.json().catch((e) => {
      console.error("Failed to parse the lambda response", e);
      return {};
    });
  });
};

export default createAPIGatewayProxyHandler(logic);
