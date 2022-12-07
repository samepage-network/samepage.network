import EmailLayout from "./EmailLayout";
import React from "react";
import { appsById } from "package/internal/apps";
import { AppId } from "package/internal/types";

const MessageHandlerErrorEmail = ({
  app,
  workspace,
  data,
  stack,
}: {
  app: AppId;
  workspace: string;
  data: Record<string, unknown>;
  stack: string;
}): React.ReactElement => (
  <EmailLayout>
    <div>
      App: <code>{appsById[app].name}</code>
    </div>
    <div>
      Workspace: <code>{workspace}</code>
    </div>
    <div>
      Context:{" "}
      <pre>
        <code>{JSON.stringify(data, null, 4)}</code>
      </pre>
    </div>
    <div>Stack:</div>
    <div>
      <pre>
        <code>{stack}</code>
      </pre>
    </div>
  </EmailLayout>
);

export default MessageHandlerErrorEmail;
