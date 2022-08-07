import type { WSHandler } from "~/types";
import endClient from "~/data/endClient.server";


export const handler: WSHandler = (event) => {
  const id = event.requestContext?.connectionId || ""
  console.log("disconnect body:", event.body);
  return endClient(id, "OnDisconnect")
    .then(() => ({ statusCode: 200, body: "Successfully Disconnected" }))
    .catch((
      // e
      ) =>
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
