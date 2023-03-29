import type { WSHandler } from "./sendmessage";
import endClient from "~/data/endClient.server";

export const handler: WSHandler = (event, context) => {
  const id = event.requestContext?.connectionId || "";
  return endClient(id, "OnDisconnect", context.awsRequestId)
    .then(() => ({ statusCode: 200, body: "Successfully Disconnected" }))
    .catch(
      (e) =>
        // e
        // emailError(
        //   `Multiplayer OnDisconnect Failure: ${event.requestContext.connectionId}`,
        //   e
        // ).then((id) =>
        {
          console.error(`Failed to disconnect: ${id}`, e);
          return {
            statusCode: 500,
            body: `Failed to disconnect: ${id}`,
          };
        }
      // )
    );
};
