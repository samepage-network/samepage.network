import { ActionFunction, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import Button from "package/components/Button";
import TextInput from "package/components/TextInput";
import createUserAssistant from "~/data/createUserAssistant.server";
import remixAppAction from "~/data/remixAppAction.server";

const AssistantsNewPage = () => {
  return (
    <Form method={"post"} className={"max-w-lg"}>
      <h3 className="text-3xl font-normal mb-12">Hire a New Assistant!</h3>
      <TextInput name={"name"} label={"Name"} />
      <TextInput name={"email"} label={"Email"} />
      <p className="mb-4">
        I agree to receive notification and response SMS from (833) 659-7438.
        Msg {"&"} data rates may apply. Reply YOU'RE FIRED to opt-out.
      </p>
      <Button>Hire</Button>
    </Form>
  );
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {
    POST: ({ context: { requestId }, data, userId }) =>
      createUserAssistant({
        requestId,
        workspace: data["workspace"]?.[0] || "",
        userId,
      }).then(({ assistantUuid }) =>
        redirect(`/user/assistants/${assistantUuid}`)
      ),
  });
};

export const handle = {
  Title: "Assistants",
};

export default AssistantsNewPage;
