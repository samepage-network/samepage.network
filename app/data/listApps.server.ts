import { apps } from "data/schema";
import getMysql from "./mysql.server";

const listApps = async ({ requestId }: { requestId: string }) => {
  const cxn = await getMysql(requestId);
  return cxn.select({ id: apps.id, name: apps.name }).from(apps);
};

export default listApps;
