import apiClient from "./apiClient";
import { ActorInfo } from "./types";

const actorCache: Record<string, ActorInfo> = {};

// empty string returns the current actor
const parseActorId = async (s = ""): Promise<ActorInfo> => {
  if (actorCache[s]) return actorCache[s];
  return apiClient<ActorInfo>({ method: "get-actor", actorId: s })
    .then((r) => {
      actorCache[s] = r;
      return r;
    })
    .catch(() => ({
      appName: "Unknown",
      workspace: "Not Found",
      email: "",
      notebookUuid: "",
      actorId: s,
    }));
};

export const parseAndFormatActorId = async (s: string) => {
  const { appName, workspace } = await parseActorId(s);
  return `${appName} / ${workspace}`;
};

export default parseActorId;
