import subscribeToConvertkitAction from "@dvargas92495/app/backend/subscribeToConvertkitAction.server";
import type { ActionFunction } from "@remix-run/node";
import invokeAsync from "./invokeAsync.server";
import issueNewInvite from "./issueNewInvite.server";
import axios from "axios";

const requestAccess: ActionFunction = async (args) => {
  const formData = await args.request.formData();
  const invite = formData.has("invite");
  const email = formData.get("email");
  return Promise.all([
    subscribeToConvertkitAction(args),
    invite
      ? issueNewInvite({
          // @ts-ignore
          context: { requestId: args.context?.lambdaContext?.awsRequestId },
        })
          .then((v) =>
            invokeAsync({
              path: "send-email",
              data: {
                to: email,
                subject: "Invite code for SamePage",
                bodyComponent: "invite-code",
                bodyProps: {
                  code: v.code,
                },
              },
            })
          )
          .catch((e) =>
            axios.post("https://api.samepage.network/errors", {
              path: "",
              stack: e.stack,
            })
          )
      : Promise.resolve(),
  ]).then(([r]) => r);
};

export default requestAccess;
