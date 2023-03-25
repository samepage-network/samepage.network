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
  code: string;
  workspaceLabel: string;
  development?: boolean;
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
    development: process.env.NODE_ENV === "production",
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
  {
    id: 8,
    name: "Airtable",
    workspaceLabel: "base",
    development: true,
  },
  {
    id: 9,
    name: "OpenAI",
    workspaceLabel: "workspace",
    development: true,
  },
].map((a) => ({ ...a, code: a.name.toLowerCase() }));

export const appsById = Object.fromEntries(APPS.map(({ id, ...a }) => [id, a]));
export const appIdByName = Object.fromEntries(
  APPS.map(({ id, name }) => [name, id] as const)
);
export const appsByCode = Object.fromEntries(
  APPS.map((a) => [a.name.toLowerCase(), a] as const)
);

export default APPS;
