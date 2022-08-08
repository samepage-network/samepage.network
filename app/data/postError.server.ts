import postToConnection from "./postToConnection.server";

const postError = (params: {
  event: { requestContext?: { connectionId?: string } };
  Message: string;
  requestId: string;
}) =>
  postToConnection({
    ConnectionId: params.event?.requestContext?.connectionId || "",
    Data: {
      operation: "ERROR",
      message: params.Message,
    },
    requestId: params.requestId,
  });

export default postError;
