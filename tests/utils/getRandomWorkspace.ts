import randomString from "~/data/randomString.server";

const getRandomWorkspace = async () =>
  `test-${await randomString({
    length: 4,
    encoding: "hex",
  })}`;

export default getRandomWorkspace;
