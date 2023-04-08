import { z } from "zod";
import dispatchAppEvent from "./dispatchAppEvent";
import { zErrorWebsocketMessage } from "./types";

const handleErrorOperation = ({
  message,
}: z.infer<typeof zErrorWebsocketMessage>) => {
  dispatchAppEvent({
    type: "log",
    id: "websocket-error",
    content: message,
    intent: "error",
  });
};

export default handleErrorOperation;
