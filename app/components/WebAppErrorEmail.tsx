import EmailLayout from "../../package/components/EmailLayout";
import React from "react";

const WebAppErrorEmail = ({
  path,
  stack,
}: {
  stack: string;
  path: string;
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
  </EmailLayout>
);

export default WebAppErrorEmail;
