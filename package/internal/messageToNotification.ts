import MESSAGES, { Operation } from "./messages";
import { JSONData, Notification } from "./types";

const messageToNotification = ({
  uuid,
  source,
  operation,
  data,
}: {
  uuid: string;
  source: {
    app: null | number;
    workspace: null | string;
    uuid: string | null;
    appName: string | null;
  };
  operation: Operation;
  data: JSONData;
}): Notification => {
  return {
    uuid,
    operation,
    title: MESSAGES[operation]?.title || "Unknown",
    description: (MESSAGES[operation]?.description || "Unknown")
      .replace(/{app}/g, source.appName || "")
      .replace(
        /{workspace}/g,
        source.workspace === null ? "Unknown" : source.workspace
      )
      .replace(/{([a-z]+)}/g, (_, key) => {
        const value = data[key];
        return typeof value === "string" ? value : JSON.stringify(value);
      }),
    data: {
      ...data,
      source: source.uuid || "",
    },
    buttons: MESSAGES[operation]?.buttons || [],
  };
};

export default messageToNotification;
