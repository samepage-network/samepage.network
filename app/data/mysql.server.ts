import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { v4 } from "uuid";

const connectionMap: Record<string, mysql.Connection> = {};

const createConnection = (id = v4()) => {
  return mysql
    .createConnection(process.env.DATABASE_URL || "")
    .then((con) => (connectionMap[id] = con))
    .catch((e) => {
      if (e.message === "Too many connections") {
        const connectionsOpen = Object.entries(connectionMap).filter(
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore their types are bad
          ([, v]) => !v.connection._closing
        );
        console.log(
          connectionsOpen.length,
          "connections open out of",
          Object.keys(connectionMap).length
        );
        connectionsOpen.forEach(([k]) => {
          console.log(k);
        });
      }
      throw e;
    });
};

const getMysql = async (_cxn?: mysql.Connection | string) => {
  const cxn =
    typeof _cxn === "undefined"
      ? await createConnection()
      : typeof _cxn === "string"
      ? connectionMap[_cxn] || (await createConnection(_cxn))
      : _cxn;
  return drizzle(cxn, { logger: !!process.env.DEBUG });
};

export default getMysql;
