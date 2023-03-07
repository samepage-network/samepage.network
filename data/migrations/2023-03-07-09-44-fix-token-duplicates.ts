import type { MigrationProps } from "fuegojs/types";

export const migrate = async (args: MigrationProps) => {
  const nullTokens = await args.connection
    .execute(
      `select t.uuid, t.user_id from tokens t left join token_notebook_links tnl on tnl.token_uuid = t.uuid where tnl.uuid is null`
    )
    .then(([a]) => a as { uuid: string; user_id: string }[]);
  return nullTokens.reduce(
    (p, c) =>
      p.then(async () => {
        const [{ count }] = await args.connection
          .execute(
            `select COUNT(uuid) as count from tokens where user_id = ?`,
            [c.user_id]
          )
          .then(([a]) => a as { count: number }[]);
        if (count > 1) {
          await args.connection.execute(`DELETE FROM tokens where uuid = ?`, [
            c.uuid,
          ]);
        }
        return Promise.resolve();
      }),
    Promise.resolve()
  );
};

export const revert = () => {
  return Promise.resolve();
};
