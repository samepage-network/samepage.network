// Playing around with the idea of the SamePage Network as App 0
// In the future, we will want organizations to be able to self host networks
// on whichever cloud or on-prem solution they want. These networks should have global
// ids and labels just like apps, making it all addressable via the 0 app:
// - SamePage/Main
// - SamePage/Org
// - etc.
type App = {
  id: number;
  name: string;
  workspaceLabel: string;
  development?: true;
};
const APPS: App[] = [
  {
    id: 0,
    name: "SamePage",
    workspaceLabel: "workspace",
  },
  {
    id: 1,
    name: "Roam",
    workspaceLabel: "graph",
  },
  {
    id: 2,
    name: "LogSeq",
    workspaceLabel: "graph",
  },
  {
    id: 3,
    name: "Obsidian",
    workspaceLabel: "vault",
  },
  {
    id: 4,
    name: "Notion",
    workspaceLabel: "workspace",
    development: true,
  },
  {
    id: 5,
    name: "Google",
    workspaceLabel: "workspace",
    development: true,
  },
  {
    id: 6,
    name: "Monday",
    workspaceLabel: "workspace",
    development: true,
  },
  {
    id: 7,
    name: "GitHub",
    workspaceLabel: "repository",
    development: true,
  },
];

export const appsById = Object.fromEntries(APPS.map(({ id, ...a }) => [id, a]));
export const appIdByName = Object.fromEntries(
  APPS.map(({ id, name }) => [name, id] as const)
);

export default APPS;
