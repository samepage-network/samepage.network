import { users } from "@clerk/clerk-sdk-node";

const getPrimaryUserEmail = (id: string) => {
  return users
    .getUser(id)
    .then(
      (u) =>
        u.emailAddresses.find((ea) => ea.id === u.primaryEmailAddressId)
          ?.emailAddress
    );
};

export default getPrimaryUserEmail;
