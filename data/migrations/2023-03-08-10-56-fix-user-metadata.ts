import { User, users } from "@clerk/clerk-sdk-node";
import Stripe from "stripe";
import { subscribe } from "~/data/subscribeToConvertkitAction.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
  maxNetworkRetries: 3,
});

export const migrate = async () => {
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
    const convertKit =
      cu.privateMetadata.convertKit === "subbed"
        ? await subscribe({ email, tag: "SignUp", form: "AutoConfirm" }).then(
            (r) => (r.success ? r.data : "failed")
          )
        : (cu.privateMetadata.convertKit as string);
    const stripeCustomerId =
      typeof cu.privateMetadata.stripeCustomerId === "string"
        ? cu.privateMetadata.stripeCustomerId
        : typeof (cu.privateMetadata.stripeCustomerId as { id: string }).id ===
          "string"
        ? (cu.privateMetadata.stripeCustomerId as { id: string }).id
        : await stripe.customers
            .list({
              email,
            })
            .then((existingCustomers) =>
              existingCustomers.data.length
                ? Promise.resolve(existingCustomers.data[0].id)
                : stripe.customers
                    .create({
                      email,
                      name:
                        cu.firstName && cu.lastName
                          ? `${cu.firstName} ${cu.lastName}`
                          : cu.firstName || cu.lastName || "",
                    })
                    .then((c) => c.id)
            );
    return users.updateUser(cu.id, {
      privateMetadata: {
        ...cu.privateMetadata,
        stripeCustomerId,
        convertKit,
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
