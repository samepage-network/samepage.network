import issueNewInvite from "~/data/issueNewInvite.server";
import getRandomEmail from "./getRandomEmail";
import { v4 } from "uuid";

const issueRandomInvite = async () =>
  issueNewInvite({
    context: { requestId: v4() },
    data: { email: [await getRandomEmail()] },
  });

export default issueRandomInvite;
