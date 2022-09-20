import { app, workspace } from "./registry";

const getActorId = () =>
  `${app}/${workspace}`
    .split("")
    .map((s) => s.charCodeAt(0).toString(16))
    .join("");

export default getActorId;
