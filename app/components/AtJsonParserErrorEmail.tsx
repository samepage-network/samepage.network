import EmailLayout from "./EmailLayout";
import React from "react";

const AtJsonParserErrorEmail = ({
  uuid,
}: {
  uuid: string;
}): React.ReactElement => (
  <EmailLayout>
    <div>
      File containing error data could be found{" "}
      <a href={`https://samepage.network/data/errors/${uuid}.json`}>here.</a>
    </div>
  </EmailLayout>
);

export default AtJsonParserErrorEmail;
