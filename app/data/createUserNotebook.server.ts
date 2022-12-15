import getMysql from "fuegojs/utils/mysql";
import { users } from "@clerk/clerk-sdk-node";
import connectNotebook from "./connectNotebook.server";

const createUserNotebook = async ({
  requestId,
  userId,
  workspace,
}: {
  requestId: string;
  workspace: string;
  userId: string;
}) => {
  const email = await users
    .getUser(userId)
    .then(
      (u) =>
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress
    );
  const cxn = await getMysql(requestId);
  const tokenUuid = await cxn
    .execute(`SELECT token_uuid FROM invitations where email = ?`, [email])
    .then(([r]) => (r as { token_uuid: string }[])[0]?.token_uuid);
  const { notebookUuid } = await connectNotebook({
    requestId,
    tokenUuid,
    app: 0,
    workspace,
  });
  return { notebookUuid, tokenUuid };
};

export default createUserNotebook;
