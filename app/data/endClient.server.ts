import getMysqlConnection from "@dvargas92495/app/backend/mysql.server";
import { z } from "zod";
import { onlineClient } from "../../data/main";

const endClient = (id: string, reason: string): Promise<void> => {
  return getMysqlConnection().then(async (cxn) => {
    const [source] = await cxn
      .execute(`SELECT * FROM online_clients WHERE id = ?`, [id])
      .then((res) => res as z.infer<typeof onlineClient>[]);
    if (source) {
      const now = new Date();
      await Promise.all([
        cxn.execute(`DELETE FROM online_clients WHERE id = ?`, [source.id]),
        cxn.execute(
          `INSERT INTO client_sessions (id, instance, client, created_date, end_date, disconnected_by)
            VALUES (?,?,?,?,?,?)`,
          [
            source.id,
            source.instance,
            source.client,
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
