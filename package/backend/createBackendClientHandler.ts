import { onAppEvent } from "package/internal/registerAppEventListener";
import { zBackendWebSocketMessage } from "../internal/types";
import sendEmail from "./sendEmail.server";

const createBackendClientHandler = () => (args: unknown) => {
  try {
    const data = zBackendWebSocketMessage.parse(args);
    onAppEvent("log", (e) => {
      if (e.intent === "info" || e.intent === "debug" || e.intent === "success")
        console.log(e.type, "-", e.content);
      if (e.intent === "warning") console.warn(e.type, "-", e.content);
      if (e.intent === "error") console.error(e.type, "-", e.content);
    });
    onAppEvent("notification", (e) => {
      // Do we send it to the SamePage email or the App email?
      // For now, these are almost always the same...
      const to = data.credentials.email;
      sendEmail({
        subject: e.notification.title,
        // TODO - present choice of actions.
        body: e.notification.description,
        to,
      });
    });

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
