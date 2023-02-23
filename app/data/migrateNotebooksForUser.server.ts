import getMysqlConnection from "fuegojs/utils/mysql";
import { users } from "@clerk/clerk-sdk-node";
import type mysql from "mysql2/promise";

// TODO - We could nuke this soon
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

export default migrateNotebooksForUser;
