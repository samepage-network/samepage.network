import { LoaderFunction } from "@remix-run/node";
import { useNavigate, useLoaderData } from "@remix-run/react";
import listEmployeesForUser from "~/data/listEmployeesForUser.server";
import remixAppLoader from "~/data/remixAppLoader.server";
import ButtonLink from "~/components/ButtonLink";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const EmployeesPage = () => {
  const navigate = useNavigate();
  const { data } =
    useLoaderData<Awaited<ReturnType<typeof listEmployeesForUser>>>();
  return (
    <div className={"flex-col gap-8 items-start h-full pb-12"}>
      <div className="max-w-3xl w-full h-full gap-4">
        {data.map((a) => (
          <div
            key={a.uuid}
            className="shadow-md rounded-sm active:border-sky-300 active:border hover:shadow-2xl max-w-[16rem] flex-col items-center hover:cursor-pointer py-4 h-fit"
            onClick={() => navigate(a.uuid)}
            title={a.name}
          >
            <div className="flex justify-center items-center">
              <div className="flex-shrink-0">
                <img
                  src={`/images/employees/avatars/${a.uuid}.png`}
                  alt={a.name}
                  className="w-24 h-24 rounded-full"
                />
              </div>
            </div>
            <div className="flex-col items-center text-center">
              <h3 className="text-2xl font-semibold my-6">{a.name}</h3>
              <p className="text-gray-500 my-4">{a.role}</p>
              <div className="flex gap-4 justify-center">
                {a.pinnedApps.map((app) => (
                  <img
                    key={app.code}
                    src={`/images/apps/${app.code}.png`}
                    alt={app.code}
                    className="w-8 h-8 rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <ButtonLink to={"new"} className={"w-fit"}>
        Hire
      </ButtonLink>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, listEmployeesForUser);
};

export const handle = {
  Title: "Employees",
};

export default EmployeesPage;
