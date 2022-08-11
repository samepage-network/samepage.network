import { APP_EVENT } from "./internal/events";
import { AppEvent } from "./types";

const onAppEvent = (handler: (event: AppEvent) => void) =>
  document.body.addEventListener(APP_EVENT, ((e: CustomEvent) =>
    handler(e.detail as AppEvent)) as EventListener);

export default onAppEvent;
