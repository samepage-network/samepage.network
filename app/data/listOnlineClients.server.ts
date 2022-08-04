import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import { schema } from "data/main";
import { z } from "zod";
import { appNameById } from "~/enums/apps";

const listOnlineClients = async () => {
  const cxn = await getMysqlConnection();
  const data = await cxn
    .execute("SELECT * FROM online_clients")
    .then((r) => r as z.infer<typeof schema.onlineClient>[]);
  cxn.destroy();
  return {
    columns: [
      { Header: "App", accessor: "app" },
      { Header: "Workspace", accessor: "instance" },
      { Header: "Date", accessor: "date" },
    ],
    data: data
      .sort((a, b) => b.created_date.valueOf() - a.created_date.valueOf())
      .map((d) => ({
        id: d.id,
        instance: d.instance || "Pending",
        app: d.app ? appNameById[d.app] : "None",
        date: d.created_date.toLocaleString(),
      })),
  };
};

export default listOnlineClients;
