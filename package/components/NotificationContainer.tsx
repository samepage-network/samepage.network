import { Button, Spinner } from "@blueprintjs/core";
import React from "react";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { onAppEvent } from "../internal/registerAppEventListener";
import apiClient from "../internal/apiClient";
import { Notification } from "../internal/types";
import Markdown from "markdown-to-jsx";

export type NotificationContainerProps = {
  actions?: Record<string, (args: Record<string, string>) => Promise<unknown>>;
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
            className={"capitalize"}
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
}: NotificationContainerProps) => {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const notificationsRef = React.useRef<Notification[]>(notifications);
  const [isOpen, setIsOpen] = React.useState(false);
  const removeNotificaton = React.useCallback(
    (not: Notification) => {
      return apiClient({
        method: "mark-message-read",
        messageUuid: not.uuid,
      }).then(() => {
        notificationsRef.current = notificationsRef.current.filter(
          (n) => n.uuid !== not.uuid
        );
        setNotifications(notificationsRef.current);
        setIsOpen(!!notificationsRef.current.length);
      });
    },
    [setNotifications, notificationsRef, setIsOpen]
  );

  React.useEffect(() => {
    apiClient<{ messages: Notification[] }>({
      method: "get-unmarked-messages",
    }).then((r) => {
      setNotifications((notificationsRef.current = r.messages));
    });
    onAppEvent("notification", (evt) => {
      if (
        notificationsRef.current.every((n) => n.uuid !== evt.notification.uuid)
      ) {
        notificationsRef.current.push(evt.notification);
        setNotifications([...notificationsRef.current]);
      }
    });
  }, [setNotifications, notificationsRef]);
  return (
    <div
      className="samepage-notification-container relative"
      style={{
        zIndex: 1000,
      }}
    >
      {notifications.length ? (
        <div className="absolute top-0 left-0 h-2 w-2 bg-red-600 rounded-full" />
      ) : (
        <></>
      )}
      {isOpen && (
        <div
          className={
            "bg-white w-72 absolute top-0 right-0 shadow-xl text-black"
          }
        >
          <div className="flex items-center justify-between py-2 px-4 bg-slate-100 bg-opacity-50 border-b border-b-black">
            <h4 className="font-normal text-lg">Notifications</h4>
            <Button onClick={() => setIsOpen(false)} icon={"cross"} minimal />
          </div>
          <div>
            {!notifications.length && (
              <div className="px-4 py-2">All caught up on notifications!</div>
            )}
            {notifications.map((not) => (
              <div key={not.uuid} className={"py-2 px-4"}>
                <h5 className="font-base text-base mb-1">{not.title}</h5>
                <Markdown
                  options={{
                    overrides: {
                      code: {
                        props: {
                          className:
                            "bg-gray-100 px-2 py-1 rounded-full font-base",
                        },
                      },
                    },
                  }}
                >
                  {not.description}
                </Markdown>
                <div className={"flex gap-2 mt-2 justify-between"}>
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
      )}
      <img
        onClick={() => setIsOpen(true)}
        src={"https://samepage.network/images/logo.png"}
        className={"rounded-full h-6 w-6 cursor-pointer shadow-xl"}
      />
    </div>
  );
};

export default NotificationContainer;
