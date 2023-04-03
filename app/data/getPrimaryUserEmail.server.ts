import { User, users } from "@clerk/clerk-sdk-node";

export const getPrimaryEmailFromUser = (u: User) =>
  u.emailAddresses.find((ea) => ea.id === u.primaryEmailAddressId)
    ?.emailAddress;

const getPrimaryUserEmail = (id: string | null) => {
  if (!id) return Promise.resolve(undefined);
  return users.getUser(id).then(getPrimaryEmailFromUser);
};

export default getPrimaryUserEmail;
