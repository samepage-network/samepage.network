import getMysqlConnection from "fuegojs/utils/mysql";

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
          res as {
            id: string;
            created_date: Date;
            notebook_uuid: string;
          }[]
      );
    if (source) {
      const now = new Date();
      await Promise.all([
        cxn.execute(`DELETE FROM online_clients WHERE id = ?`, [source.id]),
        cxn.execute(
          `INSERT INTO client_sessions (id, created_date, end_date, disconnected_by, notebook_uuid)
            VALUES (?,?,?,?,?)`,
          [
            source.id,
            source.created_date,
            now,
            reason,
            source.notebook_uuid,
          ]
        ),
      ]);
    }
  });
};

export default endClient;
