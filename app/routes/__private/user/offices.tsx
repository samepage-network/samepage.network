import { LoaderFunction } from "@remix-run/node";
import { useNavigate, useLoaderData } from "@remix-run/react";
import listOfficesForUser from "~/data/listOfficesForUser.server";
import remixAppLoader from "~/data/remixAppLoader.server";
import ButtonLink from "~/components/ButtonLink";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const OfficesPage = () => {
  const navigate = useNavigate();
  const { data } =
    useLoaderData<Awaited<ReturnType<typeof listOfficesForUser>>>();
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
            <div className="flex-col items-center text-center px-4">
              <h3 className="text-2xl font-semibold my-6">{a.name}</h3>
              <p className="text-gray-500 my-4">{a.description}</p>
            </div>
          </div>
        ))}
      </div>
      <ButtonLink to={"new"} className={"w-fit"}>
        Build
      </ButtonLink>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, listOfficesForUser);
};

export const handle = {
  Title: "Offices",
};

export default OfficesPage;
