import type { MigrationProps } from "fuegojs/types";
import { users } from "@clerk/clerk-sdk-node";
import getMysqlConnection from "fuegojs/utils/mysql";
import type mysql from "mysql2/promise";

const migrateNotebooksForUser = async ({
  context: { requestId },
  userId,
}: {
  context: { requestId: string | mysql.Connection };
  userId: string;
}) => {
  const email = await users
    .getUser(userId)
    .then(
      (u) =>
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress
    );
  const cxn = await getMysqlConnection(requestId);
  await cxn.execute(
    `UPDATE tokens t
    LEFT JOIN invitations i ON i.token_uuid = t.uuid
    SET t.user_id = ?
    WHERE t.user_id IS NULL and i.email = ?`,
    [userId, email]
  );
  if (typeof requestId === "string") cxn.destroy();
  return {
    success: true,
  };
};

export const migrate = async (args: MigrationProps) => {
  return args.connection
    .execute(
      `select t.value, i.email 
    from tokens t 
    inner join invitations i on i.token_uuid = t.uuid 
    WHERE t.user_id is null AND i.email is not NULL`,
      []
    )
    .then(([a]) => {
      const tokens = a as { value: string; email: string }[];
      return tokens.reduce((p, c, index) => {
        return p
          .then(async () => {
            const userResponse = await users.getUserList({
              emailAddress: [c.email],
            });
            if (userResponse.length > 0) {
              return migrateNotebooksForUser({
                context: { requestId: args.connection },
                userId: userResponse[0].id,
              });
            } else {
              const newUserResponse = await users.createUser({
                emailAddress: [c.email],
                password: c.value,
              });
              return migrateNotebooksForUser({
                context: { requestId: args.connection },
                userId: newUserResponse.id,
              });
            }
          })
          .then(() => {
            console.log("Migrated user", index);
            // migrate 1 email per second to not get rate limited.
            return new Promise((resolve) => setTimeout(resolve, 1000));
          });
      }, Promise.resolve());
    });
};

export const revert = () => {
  return Promise.resolve();
};
