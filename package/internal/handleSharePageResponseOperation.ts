import { z } from "zod";
import dispatchAppEvent from "./dispatchAppEvent";
import { MessageSource, zSharePageResponseWebsocketMessage } from "./types";

const handleSharePageResponseOperation = (
  {
    success,
    title,
    rejected,
  }: z.infer<typeof zSharePageResponseWebsocketMessage>,
  source: MessageSource
) => {
  if (success)
    dispatchAppEvent({
      type: "log",
      id: "share-page-accepted",
      content: `Successfully shared ${title} with ${source.appName} / ${source.workspace}!`,
      intent: "success",
    });
  else if (rejected)
    dispatchAppEvent({
      type: "log",
      id: "share-page-rejected",
      content: `Notebook ${source.appName} / ${source.workspace} rejected ${title}`,
      intent: "info",
    });
  else
    dispatchAppEvent({
      type: "log",
      id: "share-page-removed",
      content: `Notebook ${source.appName} / ${source.workspace} invite was removed from ${title}`,
      intent: "success",
    });
};

export default handleSharePageResponseOperation;
