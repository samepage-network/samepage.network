import randomString from "~/data/randomString.server";

const getRandomEmail = async (isAdmin = true) =>
  `${await randomString({
    length: 4,
    encoding: "hex",
  })}@${isAdmin ? "samepage.network" : "example.com"}`;

export default getRandomEmail;
