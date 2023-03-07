import { User, users } from "@clerk/clerk-sdk-node";
import type { MigrationProps } from "fuegojs/types";
import { v4 } from "uuid";
import randomString from "~/data/randomString.server";

export const migrate = async (args: MigrationProps) => {
  const listClerkUsers = (offset = 0): Promise<User[]> =>
    users.getUserList({ limit: 100, offset }).then(async (us) => {
      if (us.length) return us.concat(await listClerkUsers(offset + 100));
      return us;
    });
  const clerkUsers = await listClerkUsers();
  const clerkStripeMigration = clerkUsers.map((cu) => async () => {
    const { id, createdAt } = cu;
    await args.connection
      .execute(`SELECT COUNT(uuid) as count FROM tokens WHERE user_id = ?`, [
        id,
      ])
      .then(async ([a]) =>
        !(a as [{ count: number }])[0]?.count
          ? await args.connection.execute(
              `INSERT INTO tokens (uuid, value, created_date, user_id)
          VALUES (?, ?, ?, ?)`,
              [
                v4(),
                await randomString({ length: 12, encoding: "base64" }),
                new Date(createdAt),
                id,
              ]
            )
          : Promise.resolve()
      );
  });
  return clerkStripeMigration.reduce(
    (p, c, i) => p.then(c).then(() => console.log("Migrated user", i)),
    Promise.resolve()
  );
};

export const revert = () => {
  return Promise.resolve();
};
