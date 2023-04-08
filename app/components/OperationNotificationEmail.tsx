import EmailLayout from "./EmailLayout";
import React from "react";
import Markdown from "markdown-to-jsx";

const OperationNotificationEmail = ({
  description,
  actions,
  operation,
  messageUuid,
}: {
  description: string;
  actions: readonly string[];
  operation: string;
  messageUuid: string;
}): React.ReactElement => (
  <EmailLayout>
    <div
      style={{
        whiteSpace: "pre-wrap",
        fontSize: "0.875rem",
      }}
    >
      <Markdown
        options={{
          overrides: {
            code: {
              props: {
                style: {
                  backgroundColor: "#f5f5f5",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "100%",
                  fontSize: "1rem",
                },
              },
            },
          },
        }}
      >
        {description}
      </Markdown>
    </div>
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "0.5rem",
        justifyContent: "space-between",
        borderRadius: "100%",
      }}
    >
      <div className={"flex gap-8"}>
        {actions.map((action) => (
          <a
            href={`https://samepage.${
              process.env.NODE_ENV === "production" ? "network" : "ngrok.io"
            }/notifications/${operation}?action=${action}&uuid=${messageUuid}`}
          >
            <button
              key={action}
              style={{
                backgroundColor: "#f5f8fa",
                textTransform: "capitalize",
                backgroundImage:
                  "linear-gradient(to bottom,rgba(255,255,255,0.8),rgba(255,255,255,0))",
                color: "#182026",
                boxShadow:
                  "inset 0 0 0 1px rgb(16 22 26 / 20%), inset 0 -1px 0 rgb(16 22 26 / 10%)",
                display: "inline-flex",
                flexDirection: "row",
                alignItems: "center",
                border: 0,
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 14,
                justifyContent: "center",
                padding: "5px 10px",
                textAlign: "left",
                verticalAlign: "middle",
                minHeight: 30,
                minWidth: 30,
              }}
            >
              {action}
            </button>
          </a>
        ))}
      </div>
      {/* TODO
      How to mark messages as read? maybe no need?
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
      /> */}
    </div>
  </EmailLayout>
);

export default OperationNotificationEmail;
