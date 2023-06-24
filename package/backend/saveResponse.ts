import { NotebookResponseHandler } from "../internal/types";
import uploadFileContent from "./uploadFileContent";

const saveResponse: NotebookResponseHandler = ({ response, messageUuid }) => {
  return uploadFileContent({
    Key: `data/responses/${messageUuid}.json`,
    Body: JSON.stringify(response),
  });
};

export default saveResponse;
