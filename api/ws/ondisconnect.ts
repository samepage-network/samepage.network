import type { WSHandler } from "./sendmessage";
import endClient from "~/data/endClient.server";

export const handler: WSHandler = (event, context) => {
  const id = event.requestContext?.connectionId || "";
  console.log("disconnect body:", event.body);
  return endClient(id, "OnDisconnect", context.awsRequestId)
    .then(() => ({ statusCode: 200, body: "Successfully Disconnected" }))
    .catch(
      () =>
        // e
        // emailError(
        //   `Multiplayer OnDisconnect Failure: ${event.requestContext.connectionId}`,
        //   e
        // ).then((id) =>
        {
          return {
            statusCode: 500,
            body: `Failed to disconnect: ${id}`,
          };
        }
      // )
    );
};
