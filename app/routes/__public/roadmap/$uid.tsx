export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import AtJsonRendered from "package/components/AtJsonRendered";
import getRoadmapTask from "~/data/getRoadmapTask.server";

const SingleRoadmapPage = () => {
  const { description, title } =
    useLoaderData<Awaited<ReturnType<typeof getRoadmapTask>>>();
  return (
    <div className={"flex gap-4 flex-col h-full break-words"}>
      <h2 className="text-2xl font-bold">{title}</h2>
      <h6 className="text-lg font-normal">Description</h6>
      <AtJsonRendered {...description} />
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return getRoadmapTask(args);
};

export default SingleRoadmapPage;
