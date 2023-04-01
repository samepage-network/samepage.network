import { appsByCode } from "./apps";
import { app, workspace } from "./registry";

const getActorId = () =>
  `${appsByCode[app].id}/${workspace}`
    .split("")
    .map((s) => s.charCodeAt(0).toString(16))
    .join("");

export default getActorId;
