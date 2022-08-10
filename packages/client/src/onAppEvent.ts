import { AppEvent } from "./types";

const onAppEvent = (handler: (event: AppEvent) => void) =>
  document.body.addEventListener("samepage:event", ((e: CustomEvent) =>
    handler(e.detail as AppEvent)) as EventListener);

export default onAppEvent;
