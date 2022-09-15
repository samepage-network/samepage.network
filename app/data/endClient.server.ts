import getMysqlConnection from "fuegojs/utils/mysql";
import { z } from "zod";
import schema from "../../data/schema";

const endClient = (
  id: string,
  reason: string,
  requestId: string
): Promise<void> => {
  console.log("ending", id, "for", reason);
  return getMysqlConnection(requestId).then(async (cxn) => {
    const [source] = await cxn
      .execute(`SELECT * FROM online_clients WHERE id = ?`, [id])
      .then(
        ([res]) =>
          res as (Omit<z.infer<typeof schema.onlineClient>, "createdDate"> & {
            created_date: Date;
          })[]
      );
    if (source) {
      const now = new Date();
      await Promise.all([
        cxn.execute(`DELETE FROM online_clients WHERE id = ?`, [source.id]),
        cxn.execute(
          `INSERT INTO client_sessions (id, instance, app, created_date, end_date, disconnected_by)
            VALUES (?,?,?,?,?,?)`,
          [
            source.id,
            source.instance,
            source.app,
            source.created_date,
            now,
            reason,
          ]
        ),
      ]);
    }
  });
};

export default endClient;
