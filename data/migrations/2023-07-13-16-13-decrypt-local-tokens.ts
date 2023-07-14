import { setClerkApiKey, users } from "@clerk/clerk-sdk-node";
import AES from "crypto-js/aes";
import encutf8 from "crypto-js/enc-utf8";

const loadAllUsers = (limit: number) =>
  Array(limit)
    .fill(null)
    .map((_, i) => () => users.getUserList({ limit: 10, offset: i * 10 }))
    .reduce(
      (p, c) =>
        p.then((prev) =>
          c().then((uss) =>
            prev.concat(
              uss.map((u) => ({
                id: u.id,
                firstName: u.firstName,
                lastName: u.lastName,
                emails: u.emailAddresses.map((e) => e.emailAddress),
                publicMetadata: u.publicMetadata,
                privateMetadata: u.privateMetadata,
              }))
            )
          )
        ),
      Promise.resolve(
        [] as {
          id: string;
          firstName: string | null;
          lastName: string | null;
          emails: string[];
          publicMetadata: Record<string, unknown>;
          privateMetadata: Record<string, unknown>;
        }[]
      )
    );

export const migrate = async () => {
  const encryptionSecret = process.env.ROAMJS_ENCRYPTION_SECRET || "";
  setClerkApiKey(process.env.ROAMJS_CLERK_API_KEY || "");
  const allUsers = await loadAllUsers(105);
  await allUsers
    .filter((u) => !!u.privateMetadata.token)
    .map((user, index) => async () => {
      const { token } = user.privateMetadata;
      const rawToken = AES.decrypt(token as string, encryptionSecret).toString(
        encutf8
      );
      console.log(
        `RoamJS User: ${index} | Raw: ${rawToken} | From: ${token} | Email: ${user.emails[0]}`
      );
      await users.updateUser(user.id, {
        privateMetadata: {
          ...user.privateMetadata,
          rawToken,
        },
      });
      await new Promise((r) => setTimeout(r, 1000));
    })
    .reduce((p, c) => p.then(c), Promise.resolve());

  setClerkApiKey(process.env.CLERK_API_KEY || "");
  const spUsers = await loadAllUsers(128);
  await spUsers
    .filter(
      (u) =>
        !!(u.privateMetadata.roamjsMetadata as Record<string, string>)?.token
    )
    .map((user, index) => async () => {
      const { token } = user.privateMetadata.roamjsMetadata as Record<
        string,
        string
      >;
      const rawToken = AES.decrypt(token as string, encryptionSecret).toString(
        encutf8
      );
      console.log(
        `Clerk User: ${index} | Raw: ${rawToken} | From: ${token} | Email: ${user.emails[0]}`
      );
      await users.updateUser(user.id, {
        privateMetadata: {
          ...user.privateMetadata,
          roamjsMetadata: {
            ...(user.privateMetadata.roamjsMetadata as Record<string, unknown>),
            rawToken,
          },
        },
      });
      await new Promise((r) => setTimeout(r, 1000));
    })
    .reduce((p, c) => p.then(c), Promise.resolve());

  return "done!";
};
