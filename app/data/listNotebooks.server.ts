import getMysqlConnection from "fuegojs/utils/mysql";
import { appsById } from "package/internal/apps";
import { Notebook } from "package/internal/types";

const listOnlineClients = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .execute(
      `SELECT n.uuid, n.app, n.workspace, c.created_date
  FROM notebooks n 
  LEFT JOIN online_clients c ON n.uuid = c.notebook_uuid`
    )
    .then(
      ([r]) => r as ({ created_date: Date | null; uuid: string } & Notebook)[]
    );
  cxn.destroy();
  return {
    columns: [
      { Header: "App", accessor: "app" },
      { Header: "Workspace", accessor: "workspace" },
      { Header: "Date", accessor: "connected" },
    ],
    data: data
      .sort((a, b) => {
        if (!b.created_date && !a.created_date) {
          return a.app - b.app || a.workspace.localeCompare(b.workspace);
        } else if (!b.created_date) {
          return -1;
        } else if (!a.created_date) {
          return 1;
        }
        return b.created_date.valueOf() - a.created_date.valueOf();
      })
      .map((d) => ({
        uuid: d.uuid,
        workspace: d.workspace || "Pending",
        app: appsById[d.app].name,
        connected: d.created_date ? d.created_date.toLocaleString() : "OFFLINE",
      })),
  };
};

export default listOnlineClients;
