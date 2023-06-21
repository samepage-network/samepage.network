import { S3 } from "@aws-sdk/client-s3";
import { NotebookResponseHandler } from "package/internal/types";

const saveResponse: NotebookResponseHandler = ({ response, requestUuid }) => {
  const s3 = new S3({});
  return s3.putObject({
    Bucket: "samepage.network",
    Key: `data/responses/${requestUuid}.json`,
    Body: JSON.stringify(response),
  });
};

export default saveResponse;
