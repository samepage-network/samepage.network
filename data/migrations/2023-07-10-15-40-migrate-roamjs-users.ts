import { users, setClerkApiKey } from "@clerk/clerk-sdk-node";
import fs from "fs";
import { v4 } from "uuid";

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
  setClerkApiKey(process.env.ROAMJS_CLERK_API_KEY || "");
  const allUsers = await loadAllUsers(105);
  fs.writeFileSync("users.json", JSON.stringify(allUsers, null, 2));

  setClerkApiKey(process.env.CLERK_API_KEY || "");
  const spUsers = await loadAllUsers(29);
  fs.writeFileSync("sp.json", JSON.stringify(spUsers, null, 2));
  console.log(loadAllUsers);

  // const allUsers = JSON.parse(
  //   fs.readFileSync("users.json").toString()
  // ) as User[];
  // const spUsers = JSON.parse(fs.readFileSync("sp.json").toString()) as User[];

  await allUsers
    .map((u, i) => async () => {
      console.log("Processing", i, "user:", u.emails);
      const existingUser = spUsers.find((s) =>
        u.emails.some((e) => s.emails.includes(e))
      );
      const roamjsMetadata = {
        ...u.publicMetadata,
        ...u.privateMetadata,
      };
      if (existingUser) {
        await users.updateUser(existingUser.id, {
          privateMetadata: {
            ...existingUser.privateMetadata,
            roamjsMetadata,
          },
        });
        console.log("updated");
      } else {
        const tempPassword = v4();
        await users.createUser({
          firstName: u.firstName || undefined,
          lastName: u.lastName || undefined,
          emailAddress: u.emails,
          privateMetadata: {
            source: "migration",
            roamjsMetadata,
            tempPassword,
          },
          password: tempPassword,
        });
        console.log("created");
      }
      await new Promise((r) => setTimeout(r, 1000));
    })
    .reduce((p, c) => p.then(c), Promise.resolve());

  return "done!";
};
