import Table from "~/components/Table";
import getMeta from "~/data/getMeta.server";
import type { LoaderFunction } from "@remix-run/node";
import { Outlet, useNavigate } from "@remix-run/react";
import getRoadmap from "~/data/getRoadmap.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const RoadmapPage = () => {
  const navigate = useNavigate();
  return (
    <div className="max-w-6xl w-full">
      <h1 className="text-3xl font-bold mb-4">Roadmap</h1>
      <p className="mb-2 max-w-xl">
        At SamePage, we run our company entirely in our own notebooks. This
        central dashboard shows our up to date backlog of what we plan to build
        - directly from our notebooks.
      </p>
      <div className="flex items-start gap-4 w-full">
        <Table
          onRowClick={(r) => navigate((r as { id: string })["id"])}
          className={"w-full max-w-xl flex-shrink-0"}
        />
        <div className="max-w-xl w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export const loader: LoaderFunction = () => {
  return getRoadmap();
};

export const headers = () => {
  return {
    "Cache-Control": "max-age=3600, stale-while-revalidate=60", // 1 hour, 1 minute
  };
};

export const meta = getMeta({
  title: "Roadmap",
  description: "Upcoming features and tasks we aim to work on next",
  img: "/images/logo.png",
});

export default RoadmapPage;
