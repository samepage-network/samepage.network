import EmailLayout from "./EmailLayout";

const AtJsonParserErrorEmail = ({ uuid }: { uuid: string }) => (
  <EmailLayout>
    <div>
      File containing error data could be found{" "}
      <a href={`https://samepage.network/data/errors/${uuid}.json`}>here.</a>
    </div>
  </EmailLayout>
);

export default AtJsonParserErrorEmail;
