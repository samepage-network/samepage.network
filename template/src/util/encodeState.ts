import { SamePageState } from "samepage/internal/types";

const encodeState = async (_: {
  notebookPageId: string;
  token: string;
}): Promise<SamePageState> => {
  // TODO
  return { $body: { content: "", annotations: [] } };
};

export default encodeState;
