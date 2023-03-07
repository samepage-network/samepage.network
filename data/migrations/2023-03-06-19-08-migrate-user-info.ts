import { User, users } from "@clerk/clerk-sdk-node";
import type { MigrationProps } from "fuegojs/types";
import Stripe from "stripe";
import { v4 } from "uuid";
import randomString from "~/data/randomString.server";
import { subscribe } from "~/data/subscribeToConvertkitAction.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
  maxNetworkRetries: 3,
});

export const migrate = async (args: MigrationProps) => {
  const listClerkUsers = (offset = 0): Promise<User[]> =>
    users.getUserList({ limit: 100, offset }).then(async (us) => {
      if (us.length) return us.concat(await listClerkUsers(offset + 100));
      return us;
    });
  const clerkUsers = await listClerkUsers();
  const clerkStripeMigration = clerkUsers.map((cu) => async () => {
    const email = cu.emailAddresses.find(
      (ea) => ea.id === cu.primaryEmailAddressId
    )?.emailAddress;
    if (!email) return;
    const { firstName, lastName, privateMetadata = {}, id, createdAt } = cu;
    const stripeCustomerId = await stripe.customers
      .list({
        email,
      })
      .then((existingCustomers) =>
        existingCustomers.data.length
          ? Promise.resolve(existingCustomers.data[0])
          : stripe.customers.create({
              email,
              name:
                firstName && lastName
                  ? `${firstName} ${lastName}`
                  : firstName || lastName || "",
            })
      );
    await args.connection
      .execute(`SELECT COUNT(uuid) as count FROM tokens WHERE user_id = ?`, [
        id,
      ])
      .then(async ([a]) =>
        (a as [{ count: number }])[0]?.count
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
    const convertKitResponse = await subscribe({
      email,
      tag: "SignUp",
      form: "AutoConfirm",
    });
    await users.updateUser(id, {
      privateMetadata: {
        ...privateMetadata,
        stripeCustomerId,
        convertKit: convertKitResponse.success
          ? convertKitResponse.data
          : undefined,
      },
    });
  });
  return clerkStripeMigration.reduce(
    (p, c, i) => p.then(c).then(() => console.log("Migrated user", i)),
    Promise.resolve()
  );
};

export const revert = () => {
  return Promise.resolve();
};
