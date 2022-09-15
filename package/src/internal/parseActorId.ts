import { AppId, Notebook } from "../types";
import { appsById } from "./apps";

const parseActorId = (s: string): Notebook => {
  const [app, workspace] = s
    .split("")
    .map((c, i, a) =>
      i % 2 === 0 ? String.fromCharCode(parseInt(c + a[i + 1], 16)) : ""
    )
    .join("")
    .split("/");
  return { app: Number(app) as AppId, workspace };
};

export const parseAndFormatActorId = (s: string) => {
  const {app, workspace} = parseActorId(s);
  return `${appsById[app].name} / ${workspace}`;
}

export default parseActorId;
