import { LoaderFunction } from "@remix-run/node";
import {
  Outlet,
  useNavigate,
  useLoaderData,
} from "@remix-run/react";
import Table from "~/components/Table";
import listAssistantsForUser from "~/data/listAssistantsForUser.server";
import remixAppLoader from "~/data/remixAppLoader.server";
import ButtonLink from "~/components/ButtonLink";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const AssistantsPage = () => {
  const navigate = useNavigate();
  const { count } =
    useLoaderData<Awaited<ReturnType<typeof listAssistantsForUser>>>();
  return (
    <div className={"flex gap-8 items-start h-full"}>
      <div className="max-w-3xl w-full flex flex-col h-full gap-4">
        <Table
          className={`flex-grow ${count === 0 ? "hidden" : ""}`}
          onRowClick={(r) => navigate(r.uuid as string)}
        />
      </div>
      <ButtonLink to={"new"} className={"w-fit"}>
        Hire
      </ButtonLink>
      <div className={"flex-grow-1 overflow-auto"}>
        <Outlet />
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, listAssistantsForUser);
};

export const handle = {
  Title: "Assistants",
};

export default AssistantsPage;
