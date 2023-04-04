import randomString from "~/data/randomString.server";
import getRandomEmail from "./getRandomEmail";

const getRandomAccount = async (isAdmin?: boolean) => ({
  email: await getRandomEmail(isAdmin),
  password: await randomString({ length: 8, encoding: "base64" }),
});

export default getRandomAccount;
