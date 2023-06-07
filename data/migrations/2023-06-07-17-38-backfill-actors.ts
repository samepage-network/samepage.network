import { sql } from "drizzle-orm/sql";
import { MySql2Database } from "drizzle-orm/mysql2";

export const migrate = async ({
  connection,
}: {
  connection: MySql2Database;
}) => {
  return Promise.all([
    connection.execute(sql`UPDATE online_clients oc 
    INNER JOIN token_notebook_links tnl ON oc.notebook_uuid = tnl.notebook_uuid
    SET oc.actor_uuid = tnl.uuid`),
    connection.execute(sql`UPDATE client_sessions cs 
    INNER JOIN token_notebook_links tnl ON cs.notebook_uuid = tnl.notebook_uuid
    SET cs.actor_uuid = tnl.uuid`),
  ]);
};

export const revert = () => {
  return Promise.resolve();
};
