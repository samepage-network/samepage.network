export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { ActionFunction, redirect } from "@remix-run/node";
import { Form } from "@remix-run/react";
import Button from "package/components/Button";
import TextInput from "package/components/TextInput";
import createUserEmployee from "~/data/createUserEmployee.server";
import remixAppAction from "~/data/remixAppAction.server";

const EmployeesNewPage = () => {
  return (
    <Form method={"post"} className={"max-w-lg"}>
      <TextInput name={"name"} label={"Name"} />
      <TextInput name={"title"} label={"Title"} />
      {/* I want an image input here: <ImageInput name={"avatar"} label={"Avatar"} /> */}
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
    POST: ({ requestId, data, userId }) =>
      createUserEmployee({
        requestId,
        data,
        userId,
      }).then(({ employeeUuid }) =>
        redirect(`/user/employees/${employeeUuid}`)
      ),
  });
};

export const handle = {
  Title: "Hire an Employee",
};

export default EmployeesNewPage;
