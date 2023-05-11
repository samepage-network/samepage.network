import { SamePageState } from "samepage/internal/types";

const decodeState = async (_: {
  notebookPageId: string;
  state: SamePageState;
  token: string;
}) => {
  // TODO
  return { success: true };
};

export default decodeState;
