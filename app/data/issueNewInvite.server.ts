import getMysqlConnection from "fuegojs/utils/mysql";
import invokeAsync from "./invokeAsync.server";
import randomString from "./randomString.server";

const issueNewInvite = async ({
  context: { requestId },
  data,
}: {
  context: { requestId: string };
  data: Record<string, string[]>;
}) => {
  const cxn = await getMysqlConnection(requestId);
  const today = new Date();
  const nextWeek = new Date(today);
  const email = data["email"][0];
  nextWeek.setDate(nextWeek.getDate() + 7);
  const code = await randomString({ length: 4, encoding: "hex" });
  await cxn.execute(
    `INSERT INTO invitations (code, created_date, expiration_date, email)
    VALUES (?, ?, ?, ?)`,
    [code, today, nextWeek, email]
  );
  if (process.env.NODE_ENV === "production") {
    await invokeAsync({
      path: "send-email",
      data: {
        to: email,
        subject: "Invite code for SamePage",
        bodyComponent: "invite-code",
        bodyProps: {
          code,
        },
      },
    });
  }
  cxn.destroy();
  return {
    code,
  };
};

export default issueNewInvite;
