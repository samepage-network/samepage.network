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

// Playing around with the idea of the SamePage Network as App 0
// In the future, we will want organizations to be able to self host networks
// on whichever cloud or on-prem solution they want. These networks should have global
// ids and labels just like apps, making it all addressable via the 0 app: 
// - SamePage/Main
// - SamePage/Org
// - etc.
export type AppId = App["id"] | 0;

export const appNameById = Object.fromEntries(APPS.map((a) => [a.id, a.name]));
