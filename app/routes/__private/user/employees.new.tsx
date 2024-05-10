export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { ActionFunction, redirect } from "@remix-run/node";
import { Form, useSearchParams } from "@remix-run/react";
import emailError from "package/backend/emailError.server";
import Button from "package/components/Button";
import TextInput from "package/components/TextInput";
import createUserEmployee from "~/data/createUserEmployee.server";
import remixAppAction from "~/data/remixAppAction.server";

const EmployeesNewPage = () => {
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get("error");

  return (
    <Form method={"post"} className={"max-w-lg"}>
      <TextInput name={"name"} label={"Name"} />
      <TextInput name={"title"} label={"Title"} />
      {/* I want an image input here: <ImageInput name={"avatar"} label={"Avatar"} /> */}
      <p className="mb-4">
        I agree to receive notification and response SMS from (833) 659-7438.
        Msg {"&"} data rates may apply. Reply YOU'RE FIRED to opt-out.
      </p>
      {errorMessage && (
        <p className="text-red-500 mb-4">
          {errorMessage}. Please contact support@samepage.network.
        </p>
      )}
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
      })
        .then(({ employeeUuid }) => redirect(`/user/employees/${employeeUuid}`))
        .catch((error) => {
          const moreInfo = (
            <>
              <p>Request ID: {requestId}</p>
              <p>User ID: {userId}</p>
              <p>Data: {JSON.stringify(data)}</p>
            </>
          );
          emailError("Failed to create employee", error, moreInfo);
          return redirect(
            `/user/employees/new?error=${encodeURIComponent(
              "Failed to create employee"
            )}`
          );
        }),
  });
};

export const handle = {
  Title: "Hire an Employee",
};

export default EmployeesNewPage;
