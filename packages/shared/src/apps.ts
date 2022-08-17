export const APPS = [
  {
    id: 1,
    name: "Roam",
    key: "roamjs",
  },
  {
    id: 2,
    name: "LogSeq",
  },
  {
    id: 3,
    name: "Obsidian",
  },
] as const;

export type App = typeof APPS[number];
export type AppId = App["id"];

export const appNameById = Object.fromEntries(APPS.map((a) => [a.id, a.name]));
