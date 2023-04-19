import EmailLayout from "../../package/components/EmailLayout";
import React from "react";

const WebAppErrorEmail = ({
  path,
  stack,
  data,
}: {
  stack: string;
  path: string;
  data: Record<string, unknown>;
}): React.ReactElement => (
  <EmailLayout>
    <div>
      path: <code>{path}</code>
    </div>
    <div>Stack:</div>
    <div>
      <pre>
        <code>{stack}</code>
      </pre>
    </div>
    <div>Data:</div>
    <div>
      <pre style={{ whiteSpace: "break-spaces" }}>
        <code>{JSON.stringify(data, null, 2)}</code>
      </pre>
    </div>
  </EmailLayout>
);

export default WebAppErrorEmail;
