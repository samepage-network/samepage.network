import { z } from "zod";
import dispatchAppEvent from "./dispatchAppEvent";
import messageToNotification from "./messageToNotification";
import { MessageSource, zRequestDataWebsocketMessage } from "./types";

const handleRequestDataOperation = (
  data: z.infer<typeof zRequestDataWebsocketMessage>,
  source: MessageSource,
  uuid: string
) => {
  dispatchAppEvent({
    type: "notification",
    notification: messageToNotification({
      uuid,
      source,
      data,
      operation: "REQUEST_DATA",
    }),
  });
};

export default handleRequestDataOperation;
