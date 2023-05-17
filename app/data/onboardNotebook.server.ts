import { OnboardNotebookPayload } from "samepage/backend/types";
import getOrGenerateNotebookUuid from "./getOrGenerateNotebookUuid.server";
import verifyUser from "./verifyUser.server";

const onboardNotebook = async ({
  email,
  password,
  label,
  app,
  workspace,
  requestId,
}: OnboardNotebookPayload & { requestId: string }) => {
  const tokenRecord = await verifyUser({
    email,
    password,
    requestId,
  });

  const notebookUuid = await getOrGenerateNotebookUuid({
    app,
    workspace,
    requestId,
    tokenUuid: tokenRecord.uuid,
    label,
  });

  return { notebookUuid, token: tokenRecord.value };
};

export default onboardNotebook;
