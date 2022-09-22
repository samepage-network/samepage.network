import { Button, Spinner } from "@blueprintjs/core";
import React from "react";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { v4 } from "uuid";
import { onAppEvent } from "../internal/registerAppEventListener";
import { appsById } from "../internal/apps";

export type Notification = {
  uuid: string;
  title: string;
  description: string;
  data: Record<string, string>;
  buttons: string[];
};

const defaults: {
  state: Record<string, Notification>;
} & NotificationContainerProps["api"] = {
  state: {},
  addNotification: async (not) => (defaults.state[not.uuid] = not),
  deleteNotification: async (uuid) => delete defaults.state[uuid],
  getNotifications: async () => Object.values(defaults.state),
};

export type NotificationContainerProps = {
  actions?: Record<string, (args: Record<string, string>) => Promise<unknown>>;
  api?: {
    addNotification: (n: Notification) => Promise<unknown>;
    deleteNotification: (uuid: string) => Promise<unknown>;
    getNotifications: () => Promise<Notification[]>;
  };
};

const ActionButtons = ({
  actions,
  onSuccess,
}: {
  actions: {
    label: string;
    callback: () => Promise<unknown>;
  }[];
  onSuccess: () => void;
}) => {
  const [loading, setLoading] = React.useState(false);

  return (
    <>
      <div className={"flex gap-8"}>
        {actions.map((action) => (
          <Button
            key={action.label}
            text={action.label}
            className={"capitalize mr-2"}
            onClick={() => {
              setLoading(true);
              action
                .callback()
                .then(onSuccess)
                .catch((e) => {
                  dispatchAppEvent({
                    type: "log",
                    id: "notification-error",
                    content: `Failed to process notification: ${
                      e.message || e
                    }`,
                    intent: "error",
                  });
                })
                .finally(() => setLoading(false));
            }}
            disabled={loading}
          />
        ))}
      </div>
      {loading && <Spinner size={12} />}
    </>
  );
};

const NotificationContainer = ({
  actions = {},
  api: { addNotification, deleteNotification, getNotifications } = defaults,
}: NotificationContainerProps) => {
  const [notifications, setNotificatons] = React.useState<Notification[]>([]);
  const notificationsRef = React.useRef<Notification[]>(notifications);
  const removeNotificaton = React.useCallback(
    (not: Notification) => {
      return deleteNotification(not.uuid).then(() => {
        notificationsRef.current = notificationsRef.current.filter(
          (n) => n.uuid !== not.uuid
        );
        setNotificatons(notificationsRef.current);
      });
    },
    [setNotificatons, notificationsRef]
  );
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    getNotifications().then((nots) => {
      notificationsRef.current = nots;
      setNotificatons(nots);
    });
    onAppEvent("share-page", (evt) => {
      const app = appsById[evt.source.app]?.name;
      const args = {
        workspace: evt.source.workspace,
        app: `${evt.source.app}`,
        pageUuid: evt.pageUuid,
        title: evt.notebookPageId,
      };
      if (
        notificationsRef.current.every(
          (n) =>
            n.data.workspace !== args.workspace ||
            n.data.app !== args.app ||
            n.data.pageUuid !== args.pageUuid ||
            n.data.title !== args.title
        )
      ) {
        const notif = {
          uuid: v4(),
          title: "Share Page",
          description: `Notebook ${app}/${evt.source.workspace} is attempting to share page ${evt.notebookPageId}. Would you like to accept?`,
          buttons: ["accept", "reject"],
          data: args,
        };
        addNotification(notif).then(() => {
          notificationsRef.current.push(notif);
          setNotificatons([...notificationsRef.current]);
        });
      }
    });
  }, [addNotification, setNotificatons, notificationsRef, getNotifications]);
  return notifications.length ? (
    <div
      className="samepage-notification-container absolute top-16 right-16 shadow-xl"
      style={{
        zIndex: 1000,
      }}
    >
      <div className="absolute top-0 left-0 h-2 w-2 bg-red-600 rounded-full" />
      {isOpen ? (
        <div className={"bg-white w-72"}>
          <div className="flex items-center justify-between p-2 bg-slate-100 bg-opacity-50 border-b border-b-black">
            <h4>Notifications</h4>
            <Button onClick={() => setIsOpen(false)} icon={"cross"} minimal />
          </div>
          <div>
            {notifications.map((not) => (
              <div key={not.uuid} className={"pb-1 px-4"}>
                <h5>{not.title}</h5>
                <p>{not.description}</p>
                <div className={"flex g-2"}>
                  <ActionButtons
                    actions={not.buttons.map((label) => ({
                      label,
                      callback: () => {
                        const action = actions[label];
                        if (action) return action(not.data);
                        return Promise.resolve();
                      },
                    }))}
                    onSuccess={() => removeNotificaton(not)}
                  />
                  <Button
                    icon={"trash"}
                    minimal
                    small
                    onClick={() => removeNotificaton(not)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <img
          onClick={() => setIsOpen(true)}
          src={"https://samepage.network/images/logo.png"}
          className={"rounded-full h-6 w-6 cursor-pointer"}
        />
      )}
    </div>
  ) : (
    <></>
  );
};

export default NotificationContainer;
