import EmailLayout from "./EmailLayout";
import React from "react";

const ExtensionErrorEmail = ({
  app,
  workspace,
  data,
  stack,
  version,
  type,
  latest,
  file,
}: {
  app: string;
  workspace: string;
  data: string;
  stack: string;
  version: string;
  type: string;
  latest: string;
  file: string;
}): React.ReactElement => (
  <EmailLayout>
    <h1 style={{ fontSize: 32, marginBottom: 32 }}>{type}</h1>
    <div>
      Version: <code>{version}</code>
    </div>
    <div>
      Latest: <code>{latest}</code>
    </div>
    <div>
      App: <code>{app}</code>
    </div>
    <div>
      Workspace: <code>{workspace}</code>
    </div>
    <div>
      Context:{" "}
      <a href={`https://samepage.network/data/errors/${data}.json`}>
        Download.
      </a>
    </div>
    <div>Stack:</div>
    <div>
      <pre>
        <code>{stack}</code>
      </pre>
    </div>
    <div>
      Download extension{" "}
      <a
        href={`https://github.com/samepage-network/${app}-samepage/releases/download/${version}/${file}`}
      >
        here.
      </a>
    </div>
  </EmailLayout>
);

export default ExtensionErrorEmail;
