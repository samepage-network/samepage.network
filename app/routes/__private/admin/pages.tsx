import { LoaderFunction, ActionFunction } from "@remix-run/node";
import { Link, useLoaderData, Form, useActionData } from "@remix-run/react";
import remixAdminLoader from "~/data/remixAdminLoader.server";
import remixAdminAction from "~/data/remixAdminAction.server";
import listPageNotebookLinks from "~/data/listAllPageNotebookLinks.server";
import searchPageNotebookLinks from "~/data/searchPageNotebookLinks.server";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import TextInput from "~/components/TextInput";
import StatPanels from "~/components/StatPanels";
import { Chart, ChartOptions } from "react-charts";
import { useMemo } from "react";
import Button from "~/components/Button";

const AdminPagesPage = () => {
  const { pages, stats, timeSeries } =
    useLoaderData<Awaited<ReturnType<typeof listPageNotebookLinks>>>();
  const action = useActionData<
    undefined | Awaited<ReturnType<typeof searchPageNotebookLinks>>
  >();
  const barChartOptions = useMemo<
    Omit<ChartOptions<typeof pages[number]>, "data">
  >(
    () => ({
      primaryAxis: { getValue: (data) => data.range },
      secondaryAxes: [{ getValue: (data) => data.amount, elementType: "bar" }],
    }),
    []
  );
  const lineChartOptions = useMemo<
    Omit<ChartOptions<typeof timeSeries[number]>, "data">
  >(
    () => ({
      primaryAxis: { getValue: (data) => data.date },
      secondaryAxes: [{ getValue: (data) => data.total, elementType: "line" }],
    }),
    []
  );
  return (
    <div className="flex gap-12 items-start">
      <div className="w-full max-w-3xl">
        <div className="relative h-64 mb-8">
          <Chart
            options={{
              ...barChartOptions,
              data: [{ data: pages, label: "Notebooks With Page Count" }],
            }}
          />
        </div>
        <div className="relative h-64 mb-8">
          <Chart
            options={{
              ...lineChartOptions,
              data: [{ data: timeSeries, label: "Pages Created" }],
            }}
          />
        </div>
        <StatPanels stats={stats} order={["total", "max", "today"]} />
      </div>
      <div className="flex-grow">
        <Form method="post" className="flex items-center max-w-lg gap-8">
          <TextInput
            label={"Search"}
            name={"search"}
            placeholder={"Enter page name..."}
            className={"flex-grow"}
          />
          <Button>Search</Button>
        </Form>
        {action && (
          <div>
            {action.results.map((r) => (
              <Link
                to={r.uuid}
                className={
                  "text-sky-500 underline hover:no-underline hover:text-sky-700"
                }
              >
                {r.notebook_page_id}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) =>
    listPageNotebookLinks(requestId)
  );
};

export const action: ActionFunction = async (args) => {
  return remixAdminAction(args, {
    POST: searchPageNotebookLinks,
  });
};

export const handle = {
  Title: "Pages",
};

export default AdminPagesPage;
