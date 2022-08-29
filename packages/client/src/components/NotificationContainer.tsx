import { Button, Spinner } from "@blueprintjs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { v4 } from "uuid";

const NOTIFICATION_EVENT = "samepage:notification";

type Notification = {
  uuid: string;
  title: string;
  description: string;
  actions: {
    label: string;
    method: string;
    args: Record<string, string>;
  }[];
};

const defaults: {
  state: Record<string, Notification>;
} & Props["api"] = {
  state: {},
  addNotification: async (not) => (defaults.state[not.uuid] = not),
  deleteNotification: async (uuid) => delete defaults.state[uuid],
  getNotifications: async () => Object.values(defaults.state),
};

type Props = {
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
  const [loading, setLoading] = useState(false);

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
            style={{ marginRight: "8px" }}
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
}: Props) => {
  const [notifications, setNotificatons] = useState<Notification[]>([]);
  const notificationsRef = useRef<Notification[]>(notifications);
  const removeNotificaton = useCallback(
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
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    getNotifications().then((nots) => {
      notificationsRef.current = nots;
      setNotificatons(nots);
    });
    const listener = ((e: CustomEvent) => {
      addNotification(e.detail).then(() => {
        notificationsRef.current.push(e.detail);
        setNotificatons([...notificationsRef.current]);
      });
    }) as EventListener;
    document.body.addEventListener(NOTIFICATION_EVENT, listener);
    return () =>
      document.body.removeEventListener(NOTIFICATION_EVENT, listener);
  }, [addNotification, setNotificatons, notificationsRef, getNotifications]);
  return notifications.length ? (
    <div
      className="samepage-notification-container absolute bottom-2 right-2"
      style={{
        zIndex: 1000,
        boxShadow: "0px 0px 8px #00000080",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 8,
          width: 8,
          background: "red",
          borderRadius: "50%",
        }}
      />
      {isOpen ? (
        <div style={{ background: "white", width: 280 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 8,
              background: "#eeeeee80",
              borderBottom: "1px solid black",
            }}
          >
            <h4>Notifications</h4>
            <Button onClick={() => setIsOpen(false)} icon={"cross"} minimal />
          </div>
          <div>
            {notifications.map((not) => (
              <div key={not.uuid} style={{ padding: "0 16px 4px" }}>
                <h5>{not.title}</h5>
                <p>{not.description}</p>
                <div style={{ gap: 8 }} className={"flex"}>
                  <ActionButtons
                    actions={not.actions.map((a) => ({
                      label: a.label,
                      callback: () => {
                        const action = actions[a.method];
                        if (action) return action(a.args);
                        return Promise.resolve();
                      },
                    }))}
                    onSuccess={() => removeNotificaton(not)}
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
          style={{
            borderRadius: "50%",
            height: 24,
            width: 24,
            cursor: "pointer",
          }}
        />
      )}
    </div>
  ) : (
    <></>
  );
};

export const notify = (detail: Omit<Notification, "uuid">) =>
  document.body.dispatchEvent(
    new CustomEvent(NOTIFICATION_EVENT, {
      detail: { ...detail, uuid: v4() },
    })
  );

export default NotificationContainer;
