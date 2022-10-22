import getMysqlConnection from "fuegojs/utils/mysql";
import { appsById } from "package/internal/apps";
import { Notebook } from "package/internal/types";

const listOnlineClients = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn
    .execute(
      `SELECT n.app, n.workspace, c.created_date, c.id
  FROM online_clients c 
  INNER JOIN notebooks n ON n.uuid = c.notebook_uuid`
    )
    .then(([r]) => r as ({ created_date: Date; id: string } & Notebook)[]);
  cxn.destroy();
  return {
    columns: [
      { Header: "App", accessor: "app" },
      { Header: "Workspace", accessor: "workspace" },
      { Header: "Date", accessor: "date" },
    ],
    data: data
      .sort((a, b) => b.created_date.valueOf() - a.created_date.valueOf())
      .map((d) => ({
        id: d.id,
        workspace: d.workspace || "Pending",
        app: appsById[d.app].name,
        date: d.created_date.toLocaleString(),
      })),
  };
};

export default listOnlineClients;
