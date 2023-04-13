export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import loadNotebookAnalytics from "~/data/loadNotebookAnalytics.server";
import { Chart, ChartOptions } from "react-charts";
import { useMemo } from "react";
import parseRemixContext from "~/data/parseRemixContext.server";

const AnalyticsNotebooksPage = () => {
  const { data } =
    useLoaderData<Awaited<ReturnType<typeof loadNotebookAnalytics>>>();
  const lineChartOptions = useMemo<
    Omit<ChartOptions<(typeof data)[number]>, "data">
  >(
    () => ({
      primaryAxis: {
        getValue: (data) => new Date(data.date),
        formatters: {
          tooltip: (value: Date) =>
            value
              ? `${value.getFullYear()}/${(value.getMonth() + 1)
                  .toString()
                  .padStart(2, "0")}/${value
                  .getDate()
                  .toString()
                  .padStart(2, "0")}`
              : "",
        },
        max: new Date(),
      },
      secondaryAxes: [
        {
          getValue: (data) => data.notebooks,
          elementType: "line",
          min: 0,
          tickCount: 4,
        },
      ],
    }),
    []
  );
  return (
    <div className="h-96">
      <Chart
        options={{
          ...lineChartOptions,
          data: [{ label: "Notebooks Connected", data }],
        }}
      />
    </div>
  );
};

export const loader: LoaderFunction = ({ context }) => {
  return loadNotebookAnalytics({
    requestId: parseRemixContext(context).lambdaContext.awsRequestId,
  });
};

export default AnalyticsNotebooksPage;
