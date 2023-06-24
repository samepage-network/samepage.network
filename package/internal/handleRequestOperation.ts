import { z } from "zod";
import apiClient from "./apiClient";
import {
  JSONData,
  MessageSource,
  NotebookRequestHandler,
  zRequestWebsocketMessage,
} from "./types";

const handleRequestOperation = async (
  {
    request,
    requestUuid,
  }: Pick<z.infer<typeof zRequestWebsocketMessage>, "request" | "requestUuid">,
  source: Pick<MessageSource, "uuid">,
  messageUuid: string,
  notebookRequestHandlers: NotebookRequestHandler[]
) => {
  const response = await notebookRequestHandlers.reduce(
    (p, c) => p.then((prev) => prev || c({ request })),
    Promise.resolve() as Promise<JSONData | undefined>
  );
  if (response) {
    await apiClient({
      method: "notebook-response",
      response,
      target: source.uuid,
      requestUuid,
      messageUuid,
    });
  }
};

export default handleRequestOperation;
