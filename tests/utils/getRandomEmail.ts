import randomString from "~/data/randomString.server";

const getRandomEmail = async () =>
  `${await randomString({
    length: 4,
    encoding: "hex",
  })}@samepage.network`;

export default getRandomEmail;
