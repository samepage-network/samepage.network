const CLIENTS = [
  { id: 1, name: "Roam" },
  { id: 2, name: "LogSeq" },
  { id: 3, name: "Obsidian" },
] as const;

export type ClientId = typeof CLIENTS[number]["id"];

export default CLIENTS;
