import { Button, Spinner } from "@blueprintjs/core";
import React from "react";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { onAppEvent } from "../internal/registerAppEventListener";
import {
  ConnectionStatus,
  MessageSource,
  Notification,
} from "../internal/types";
import Markdown from "markdown-to-jsx";
import { callNotificationAction } from "../internal/notificationActions";
import apiClient from "../internal/apiClient";
import sendExtensionError from "../internal/sendExtensionError";
import { getSetting, samePageBackend } from "../internal/registry";
import MESSAGES, { Operation } from "../internal/messages";
import { handleMessage } from "../internal/setupMessageHandlers";

const ActionButtons = ({
  notification,
  removeNotification,
}: {
  notification: Notification;
  removeNotification: (not: Notification) => void;
}) => {
  const [loading, setLoading] = React.useState(false);

  return (
    <>
      <div className={"flex gap-8"}>
        {notification.buttons.map((label) => (
          <Button
            key={label}
            text={label}
            className={"capitalize"}
            onClick={() => {
              setLoading(true);
              callNotificationAction({
                operation: notification.operation,
                label,
                data: notification.data,
                messageUuid: notification.uuid,
              })
                .then(() => removeNotification(notification))
                .catch((e) => {
                  if (!e.skipEmail)
                    sendExtensionError({
                      type: "Failed to run notification action",
                      error: e as Error,
                      data: {
                        label,
                        data: notification.data,
                        uuid: notification.uuid,
                      },
                    });
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

const NotificationContainer = ({ onLogOut }: { onLogOut?: () => void }) => {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const notificationsRef = React.useRef<Notification[]>(notifications);
  const [isOpen, setIsOpen] = React.useState(false);
  const [status, setStatus] = React.useState<ConnectionStatus>(
    samePageBackend.status
  );
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
    const offNotificationEvent = onAppEvent("notification", (evt) => {
      if (
        notificationsRef.current.every((n) => n.uuid !== evt.notification.uuid)
      ) {
        notificationsRef.current.push(evt.notification);
        setNotifications([...notificationsRef.current]);
      }
    });
    const offConnectionEvent = onAppEvent("connection", (evt) => {
      setStatus(evt.status);
      if (evt.status !== "CONNECTED") return;

      // TODO - Problems to solve with this:
      // 1. 2N + 1 API calls. Might as well do it all in `get-unmarked-messages` and remove the metadata column
      // 2. Weird dependency between buttons.length being nonzero and auto marking as read
      apiClient<{ messages: Notification[] }>({
        method: "get-unmarked-messages",
      }).then(async (r) =>
        Promise.all(
          r.messages.map((msg) =>
            apiClient<{
              data: string;
              source: MessageSource;
              operation: Operation;
            }>({
              method: "load-message",
              messageUuid: msg.uuid,
            }).then((r) => {
              handleMessage({
                content: r.data,
                source: r.source,
                uuid: msg.uuid,
              });
              if (!MESSAGES[r.operation]?.buttons?.length)
                return apiClient({
                  messageUuid: msg.uuid,
                  method: "mark-message-read",
                }).then(() => undefined);
              else return msg;
            })
          )
        )
      );
    });
    return () => {
      offNotificationEvent();
      offConnectionEvent();
    };
  }, [setNotifications, notificationsRef]);
  return (
    <div
      className="samepage-notification-container relative"
      style={{
        zIndex: 1000,
      }}
    >
      <style>{`.samepage-notification-container img { -webkit-app-region: no-drag; }`}</style>
      {notifications.length ? (
        <div
          className="absolute top-0 left-0 h-2 w-2 bg-red-600 rounded-full"
          role={"alert"}
        />
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
            <h4 className="font-normal text-lg my-0">
              {status === "CONNECTED" ? "Notifications" : "Disconnected"}
            </h4>
            <Button onClick={() => setIsOpen(false)} icon={"cross"} minimal />
          </div>
          <div>
            {!getSetting("uuid") ? (
              <div className="px-4 py-2">
                We still need to onboard this notebook before connecting to
                SamePage. Enter the "Onboard to SamePage" command to get
                started!
              </div>
            ) : status !== "CONNECTED" ? (
              <div className="px-4 py-2">
                Enter the "Connect to SamePage Network" command to connect!
              </div>
            ) : !notifications.length ? (
              <div className="px-4 py-2">All caught up on notifications!</div>
            ) : (
              notifications.map((not) => (
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
                      notification={not}
                      removeNotification={removeNotification}
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
              ))
            )}
          </div>
          {status === "CONNECTED" && (
            <div className="my-4 px-4">
              <Button text={"Log out"} onClick={onLogOut} intent={"warning"} />
            </div>
          )}
        </div>
      )}
      <img
        onClick={() => setIsOpen(true)}
        src={"https://samepage.network/images/logo.png"}
        className={`rounded-full h-6 w-6 cursor-pointer shadow-xl ${
          status === "CONNECTED" ? "" : "bg-opacity-50"
        }`}
        style={{
          opacity: status === "CONNECTED" || isOpen ? 1 : 0.5,
        }}
      />
    </div>
  );
};

export default NotificationContainer;
