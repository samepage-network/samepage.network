import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import schema from "data/schema";
import { z } from "zod";
import { appNameById } from "~/enums/apps";

const listOnlineClients = async (requestId: string) => {
  const cxn = await getMysqlConnection(requestId);
  const data = await cxn.execute("SELECT * FROM online_clients").then(
    ([r]) =>
      r as (Omit<z.infer<typeof schema.onlineClient>, "createdDate"> & {
        created_date: Date;
      })[]
  );
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
        workspace: d.instance || "Pending",
        app: d.app ? appNameById[d.app] : "None",
        date: d.created_date.toLocaleString(),
      })),
  };
};

export default listOnlineClients;
