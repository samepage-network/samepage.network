import EmailLayout from "./EmailLayout";

const AtJsonParserErrorEmail = ({
  input,
  results,
}: {
  input: string;
  results: unknown[];
}) => (
  <EmailLayout>
    <div>Input:</div>
    <pre>
      <code>{input}</code>
    </pre>
    <div>Results:</div>
    <pre>
      <code>{JSON.stringify(results, null, 4)}</code>
    </pre>
  </EmailLayout>
);

export default AtJsonParserErrorEmail;
