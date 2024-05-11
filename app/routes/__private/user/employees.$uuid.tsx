import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { useLoaderData, useMatches, Form, Link } from "@remix-run/react";
import Button from "package/components/Button";
import { useRef } from "react";
import Dialog, { DialogRef } from "~/components/Dialog";
import getUserEmployeeProfile from "~/data/getUserEmployeeProfile.server";
import fireUserEmployee from "~/data/fireUserEmployee.server";
import remixAppAction from "~/data/remixAppAction.server";
import remixAppLoader from "~/data/remixAppLoader.server";

const EmployeeProfilePage = () => {
  const employee =
    useLoaderData<Awaited<ReturnType<typeof getUserEmployeeProfile>>>();
  const fireEmployeeRef = useRef<DialogRef>(null);
  return (
    <div className="flex flex-col h-full">
      <h1 className="text-3xl font-semibold mb-4">{employee.title}</h1>
      <div className="mb-16 border-dashed border p-4">
        <h3 className="text-lg font-bold mb-4">Employee Device Info</h3>
        <p className="italic mb-2">
          {employee.instance.id} - {employee.instance.state}
        </p>
        <div className="flex justify-between items-start">
          <code>
            ssh -i {employee.uuid}.pem {employee.instance.username}@
            {employee.instance.dnsName}
          </code>
          <Link
            to="key"
            download={`${employee.uuid}.pem`}
            className="underline text-sky-500"
            reloadDocument
          >
            Download Private Key
          </Link>
        </div>
      </div>
      <div className="flex-grow">
        <h2 className="text-2xl">Responsibilities</h2>
        {employee.responsibilities.map((r) => (
          <div key={r.uuid}>Enter Responsibility Here</div>
        ))}
      </div>
      <div>
        <Button
          intent="danger"
          onClick={() => fireEmployeeRef.current?.openDialog()}
        >
          Fire
        </Button>
        <Dialog ref={fireEmployeeRef} title="Fire Employee">
          <p className="my-8">Are you sure you want to fire {employee.name}?</p>
          <Form method="delete">
            <Button intent="danger">Fire</Button>
          </Form>
        </Dialog>
      </div>
    </div>
  );
};

const Title = () => {
  const matches = useMatches();
  const employee = matches[3].data as Awaited<
    ReturnType<typeof getUserEmployeeProfile>
  >;
  return <span className="normal-case">{employee.name}</span>;
};

export const handle = { Title };

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, getUserEmployeeProfile);
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {
    DELETE: ({ userId, params, requestId }) =>
      fireUserEmployee({
        userId,
        employeeId: params.uuid,
        requestId,
      }).then(() => redirect("/user/employees")),
  });
};

export default EmployeeProfilePage;
