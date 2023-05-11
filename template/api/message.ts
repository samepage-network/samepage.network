import createBackendClientHandler from "samepage/backend/createBackendClientHandler";
import { notebookRequestNodeQuerySchema } from "samepage/internal/types";
import fireNodeQuery from "samepage/utils/fireNodeQuery";
import decodeState from "../src/util/decodeState";
import encodeState from "../src/util/encodeState";

const message = createBackendClientHandler({
  getDecodeState: (token) => (id, state) => {
    return decodeState({id, state, token});
  },
  getNotebookRequestHandler:
    (token) =>
    async ({ request }) => {
      if (request.schema === "node-query") {
        const result = notebookRequestNodeQuerySchema.safeParse(request);
        if (!result.success) return {};
        const results = await fireNodeQuery(result.data, {});
        return {
          results,
        };
      } else if (typeof request.notebookPageId === "string") {
        const pageData = await encodeState({
          notebookPageId: request.notebookPageId,
          token,
        });
        return pageData;
      }
      return {};
    },
  getNotebookResponseHandler: (token) => async (response) => {
    // TODO
  },
});

export default message;
