import type { MigrationProps } from "fuegojs/types";
import migrateNotebooksForUser from "~/data/migrateNotebooksForUser.server";
import { users } from "@clerk/clerk-sdk-node";

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
