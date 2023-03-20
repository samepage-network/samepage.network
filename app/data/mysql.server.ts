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
        Object.entries(connectionMap)
          .filter(
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore their types are bad
            ([, v]) => !v.connection.stream.destroyed
          )
          .forEach(([k]) => {
            console.log("Connections still open:", k);
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
  return drizzle(cxn);
};

export default getMysql;
