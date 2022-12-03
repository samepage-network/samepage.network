import randomString from "~/data/randomString.server";

const getRandomNotebookPageId = async () =>
  `page-${await randomString({
    length: 4,
    encoding: "hex",
  })}`;

export default getRandomNotebookPageId;
