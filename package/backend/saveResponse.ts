import { NotebookResponseHandler } from "package/internal/types";
import uploadFileContent from "./uploadFileContent";

const saveResponse: NotebookResponseHandler = ({ response, requestUuid }) => {
  return uploadFileContent({
    Key: `data/responses/${requestUuid}.json`,
    Body: JSON.stringify(response),
  });
};

export default saveResponse;
