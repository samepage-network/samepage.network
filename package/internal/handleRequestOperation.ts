import { z } from "zod";
import apiClient from "./apiClient";
import {
  JSONData,
  MessageSource,
  NotebookRequestHandler,
  zRequestWebsocketMessage,
} from "./types";

const handleRequestOperation = async (
  { request }: z.infer<typeof zRequestWebsocketMessage>,
  source: MessageSource,
  notebookRequestHandlers: NotebookRequestHandler[]
) => {
  const response = await notebookRequestHandlers.reduce(
    (p, c) => p.then((prev) => prev || c(request)),
    Promise.resolve() as Promise<JSONData | undefined>
  );
  if (response) {
    await apiClient({
      method: "notebook-response",
      request,
      response,
      target: source.uuid,
    });
  }
};

export default handleRequestOperation;
