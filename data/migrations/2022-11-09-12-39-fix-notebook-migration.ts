import type { MigrationProps } from "fuegojs/types";

export const migrate = async (args: MigrationProps) => {
  const [notebooks] = await args.connection.execute(
    `select max(uuid) as id, count(uuid) as n, workspace from notebooks group by workspace order by n desc`
  );
  const toFix = (
    notebooks as { id: string; n: number; workspace: string }[]
  ).filter(({ n }) => n > 1);
  await Promise.all(
    toFix.map(async ({ id, workspace }) => {
      await args.connection.execute(
        `UPDATE notebooks n INNER JOIN client_sessions m ON m.notebook_uuid = n.uuid set m.notebook_uuid = ? where workspace = ?`,
        [id, workspace]
      );
      await args.connection.execute(
        `UPDATE notebooks n INNER JOIN messages m ON m.source = n.uuid set m.source = ? where workspace = ?`,
        [id, workspace]
      );
      await args.connection.execute(
        `UPDATE notebooks n INNER JOIN messages m ON m.target = n.uuid set m.target = ? where workspace = ?`,
        [id, workspace]
      );
      await args.connection.execute(
        `UPDATE notebooks n INNER JOIN page_notebook_links m ON m.notebook_uuid = n.uuid set m.notebook_uuid = ? where workspace = ?`,
        [id, workspace]
      );
      await args.connection.execute(
        `UPDATE notebooks n INNER JOIN page_notebook_links m ON m.invited_by = n.uuid set m.invited_by = ? where workspace = ?`,
        [id, workspace]
      );
      await args.connection.execute(
        `DELETE from notebooks n where workspace = ? AND uuid != ?`,
        [workspace, id]
      );
    })
  );
};

export const revert = () => {
  return Promise.resolve();
};
