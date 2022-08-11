const APPS = [
  {
    id: 1,
    name: "Roam",
    url: "https://roamjs.com/samepage/download/extension.js",
  },
  {
    id: 2,
    name: "LogSeq",
    url: "https://samepage.network/extensions/logseq.html",
  },
  {
    id: 3,
    name: "Obsidian",
    disabled: true,
    url: "https://samepage.network/extensions/obsidian.html",
  },
] as const;

export type AppId = typeof APPS[number]["id"];

export const appNameById = Object.fromEntries(APPS.map((a) => [a.id, a.name]));
export const appUrlById = Object.fromEntries(APPS.map((a) => [a.id, a.url]));

export default APPS;
