import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useMatches } from "@remix-run/react";
import Button from "package/components/Button";
import { useRef } from "react";
import Dialog, { DialogRef } from "~/components/Dialog";
import getUserEmployeeProfile from "~/data/getUserEmployeeProfile.server";
import remixAppAction from "~/data/remixAppAction.server";
import remixAppLoader from "~/data/remixAppLoader.server";

const EmployeeProfilePage = () => {
  const { employee, responsibilities } =
    useLoaderData<Awaited<ReturnType<typeof getUserEmployeeProfile>>>();
  const fireEmployeeRef = useRef<DialogRef>(null);
  return (
    <div className="flex flex-col">
      <h1 className="text-3xl font-semibold mb-4">{employee.title}</h1>
      <h3 className="text-md italic mb-16">{employee.instanceId}</h3>
      <div className="flex-grow">
        <h2 className="text-2xl">Responsibilities</h2>
        {responsibilities.map((r) => (
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
          <form action="DELETE">
            <Button intent="danger">Fire</Button>
          </form>
        </Dialog>
      </div>
    </div>
  );
};

const Title = () => {
  const matches = useMatches();
  const data = matches[3].data as Awaited<
    ReturnType<typeof getUserEmployeeProfile>
  >;
  return <span className="normal-case">{data.employee.name}</span>;
};

export const handle = { Title };

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, getUserEmployeeProfile);
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {
    DELETE: () => {},
  });
};

export default EmployeeProfilePage;
