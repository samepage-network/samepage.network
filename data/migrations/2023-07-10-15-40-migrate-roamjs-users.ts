import { users, setClerkApiKey } from "@clerk/clerk-sdk-node";
import fs from "fs";

export const migrate = async () => {
  setClerkApiKey(process.env.ROAMJS_CLERK_API_KEY || "");
  const allUsers = await Array(105)
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
  fs.writeFileSync("users.json", JSON.stringify(allUsers, null, 2));
  return allUsers.length;
};
