import { LoaderFunction } from "@remix-run/node";
import { useLoaderData, useMatches } from "@remix-run/react";
import getUserEmployeeProfile from "~/data/getUserEmployeeProfile.server";
import remixAppLoader from "~/data/remixAppLoader.server";

const EmployeeProfilePage = () => {
  const { employee, responsibilities } =
    useLoaderData<Awaited<ReturnType<typeof getUserEmployeeProfile>>>();
  return (
    <div>
      <h1 className="text-4xl font-bold">{employee.title}</h1>
      <div>
        <h2 className="text-2xl">Responsibilities</h2>
        {responsibilities.map((r) => (
          <div key={r.uuid}>Enter Responsibility Here</div>
        ))}
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

export default EmployeeProfilePage;
