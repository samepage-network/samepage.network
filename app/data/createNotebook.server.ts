import randomString from "./randomString.server";
import { v4 } from "uuid";
import getMysql from "~/data/mysql.server";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";
import { tokens } from "data/schema";

const createNotebook = async ({
  requestId,
  app,
  workspace,
  userId,
}: {
  requestId: string;
  userId: string;
  app: string | number;
  workspace: string;
}) => {
  const token = await randomString({ length: 12, encoding: "base64" });
  const tokenUuid = v4();
  const cxn = await getMysql(requestId);
  await cxn
    .insert(tokens)
    .values({ uuid: tokenUuid, value: token, createdDate: new Date(), userId });
  const notebookUuid = await getOrGenerateNotebookUuid({
    requestId,
    app,
    workspace,
    tokenUuid,
  });
  return { notebookUuid, token, tokenUuid };
};

export default createNotebook;
