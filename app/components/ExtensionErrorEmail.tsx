import EmailLayout from "./EmailLayout";
import React from "react";
import { appsById } from "package/internal/apps";
import { AppId } from "package/internal/types";

const ExtensionErrorEmail = ({
  app,
  workspace,
  data,
  stack,
  version,
  type,
}: {
  app: AppId;
  workspace: string;
  data: Record<string, unknown>;
  stack: string;
  version: string;
  type: string;
}): React.ReactElement => (
  <EmailLayout>
    <h1 style={{ fontSize: 32, marginBottom: 32 }}>{type}</h1>
    <div>
      Version: <code>{version}</code>
    </div>
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
    <div>
      Download{" "}
      <a
        href={`https://github.com/samepage-network/${appsById[
          app
        ].name.toLowerCase()}-samepage/releases/download/${version}/main.js`}
      >
        here.
      </a>
    </div>
  </EmailLayout>
);

export default ExtensionErrorEmail;
