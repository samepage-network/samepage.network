import {
  addNotebookListener,
  removeNotebookListener,
} from "../internal/setupMessageHandlers";
import apiClient from "../internal/apiClient";
import { InitialSchema, JSONData } from "../internal/types";

// @deprecate this whole method...
const setupNotebookQuerying = ({
  onQuery = () => Promise.resolve({ content: "", annotations: [] }),
  onQueryResponse = () => Promise.resolve(),
}: {
  onQuery?: (notebookPageId: string) => Promise<InitialSchema>;
  onQueryResponse?: (response: {
    data: InitialSchema;
    request: string;
  }) => Promise<unknown>;
  onRequest?: (request: JSONData) => Promise<JSONData>;
  onResponse?: (data: {
    response: JSONData;
    request: JSONData;
  }) => Promise<unknown>;
}) => {
  addNotebookListener({
    operation: "QUERY",
    handler: async (e, source) => {
      const { request } = e as { request: string };
      const [, notebookPageId] = request.split(":");
      const data = await onQuery(notebookPageId);
      apiClient({
        method: "query-response",
        request,
        data,
        target: source.uuid,
      });
    },
  });
  addNotebookListener({
    operation: "QUERY_RESPONSE",
    handler: (e) => {
      onQueryResponse(
        e as {
          found: boolean;
          data: InitialSchema;
          request: string;
        }
      );
    },
  });

  
  return {
    unload: () => {
      removeNotebookListener({ operation: "QUERY" });
      removeNotebookListener({ operation: "QUERY_RESPONSE" });
    },
    query: (request: string) =>
      apiClient<{
        found: boolean;
        data: InitialSchema;
      }>({
        method: "query",
        request,
      }),
  };
};

export default setupNotebookQuerying;
