import { zBackendWebSocketMessage } from "../internal/types";

const createBackendClientHandler = () => (args: unknown) => {
  try {
    const data = zBackendWebSocketMessage.parse(args);
    if (data.operation === "ERROR") {
      console.error("ERROR", data.message);
    } else if (data.operation === "AUTHENTICATION") {
      // TODO - Unsupported right?
    } else if (data.operation === "PONG") {
      // TODO - Unsupported right?
    } else if (data.operation === "SHARE_PAGE") {
      // TODO: How do we dispatch a notification and
      // allow a choice between "Accept" and "Reject"?
      // EMAIL! EMAIL IS THE ANSWER!!!
      // - Both buttons are in the email and take you to a public SamePage route.
      // - That route then performs the accept or reject, redirecting you to the notebook. BOOM!
    }
    return { success: true };
  } catch (e) {
    return { success: false };
  }
};

export default createBackendClientHandler;
