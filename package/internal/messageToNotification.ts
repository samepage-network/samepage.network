import { appsById } from "./apps";
import MESSAGES, { Operation } from "./messages";
import { Notification } from "./types";

const messageToNotification = ({
  uuid,
  source,
  operation,
  data,
}: {
  uuid: string;
  source: { app: null | number; workspace: null | string };
  operation: Operation;
  data: Record<string, string>;
}): Notification => {
  return {
    uuid,
    operation,
    title: MESSAGES[operation]?.title || "Unknown",
    description: (MESSAGES[operation]?.description || "Unknown")
      .replace(
        /{app}/g,
        source.app === null ? "Unknown" : appsById[source.app].name
      )
      .replace(
        /{workspace}/g,
        source.workspace === null ? "Unknown" : source.workspace
      )
      .replace(/{([a-z]+)}/g, (_, key) => data[key]),
    data,
    buttons: MESSAGES[operation]?.buttons || [],
  };
};

export default messageToNotification;
