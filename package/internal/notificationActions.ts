import apiClient from "./apiClient";
import type { Operation } from "./messages";

type NotificationActions = Record<
  string,
  (args: Record<string, string>) => Promise<unknown>
>;
const notificationActions: {
  [k in Operation]?: NotificationActions;
} = {};

export const registerNotificationActions = ({
  operation,
  actions,
}: {
  operation: Operation;
  actions: NotificationActions;
}) => (notificationActions[operation] = actions);

export const callNotificationAction = ({
  operation,
  label,
  data,
  messageUuid,
}: {
  operation: Operation;
  label: string;
  data: Record<string, string>;
  messageUuid: string;
}) => {
  const action = notificationActions[operation]?.[label];
  return (action ? action(data) : Promise.resolve()).then(() =>
    apiClient({
      method: "mark-message-read",
      messageUuid,
    })
  );
};
