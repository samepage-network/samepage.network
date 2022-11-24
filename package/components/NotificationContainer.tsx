import { Button, Spinner } from "@blueprintjs/core";
import React from "react";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { onAppEvent } from "../internal/registerAppEventListener";
import { Notification } from "../internal/types";
import Markdown from "markdown-to-jsx";
import { callNotificationAction } from "../internal/messages";
import apiClient from "../internal/apiClient";

const ActionButtons = ({
  actions,
}: {
  actions: {
    label: string;
    callback: () => Promise<unknown>;
  }[];
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

const NotificationContainer = () => {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const notificationsRef = React.useRef<Notification[]>(notifications);
  const [isOpen, setIsOpen] = React.useState(false);
  const removeNotification = React.useCallback(
    (not: Notification) => {
      notificationsRef.current = notificationsRef.current.filter(
        (n) => n.uuid !== not.uuid
      );
      setNotifications(notificationsRef.current);
      setIsOpen(!!notificationsRef.current.length);
    },
    [setNotifications, notificationsRef, setIsOpen]
  );

  React.useEffect(() => {
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
          <div className="flex items-center justify-between py-2 px-4 bg-slate-100 bg-opacity-50 border-b border-b-black border-solid">
            <h4 className="font-normal text-lg">Notifications</h4>
            <Button
              onClick={() => setIsOpen(false)}
              icon={"cross"}
              minimal
              className=""
            />
          </div>
          <div>
            {!notifications.length && (
              <div className="px-4 py-2 text-sm">
                All caught up on notifications!
              </div>
            )}
            {notifications.map((not) => (
              <div key={not.uuid} className={"py-2 px-4"}>
                <h5 className="font-base text-base mb-1">{not.title}</h5>
                <div className="text-sm whitespace-pre-wrap">
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
                </div>
                <div className={"flex gap-2 mt-2 justify-between"}>
                  <ActionButtons
                    actions={not.buttons.map((label) => ({
                      label,
                      callback: () => {
                        return callNotificationAction({
                          operation: not.operation,
                          label,
                          data: not.data,
                          messageUuid: not.uuid,
                        }).then(() => removeNotification(not));
                      },
                    }))}
                  />
                  <Button
                    icon={"trash"}
                    minimal
                    small
                    onClick={() => {
                      removeNotification(not);
                      apiClient({
                        method: "mark-message-read",
                        messageUuid: not.uuid,
                      });
                    }}
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
