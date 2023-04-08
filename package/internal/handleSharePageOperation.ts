import { z } from "zod";
import dispatchAppEvent from "./dispatchAppEvent";
import messageToNotification from "./messageToNotification";
import { MessageSource, zSharePageWebsocketMessage } from "./types";

const handleSharePageOperation = (
  data: z.infer<typeof zSharePageWebsocketMessage>,
  source: MessageSource,
  uuid: string
) => {
  dispatchAppEvent({
    type: "notification",
    notification: messageToNotification({
      uuid,
      source,
      data,
      operation: "SHARE_PAGE",
    }),
  });
};

export default handleSharePageOperation;
