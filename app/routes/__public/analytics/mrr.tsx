export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import loadMRRAnalytics from "~/data/loadMRRAnalytics.server";
import { Chart, ChartOptions } from "react-charts";
import { useMemo } from "react";
import parseRequestContext from "package/internal/parseRequestContext";

const AnalyticsMRRPage = () => {
  const { data } =
    useLoaderData<Awaited<ReturnType<typeof loadMRRAnalytics>>>();
  const lineChartOptions = useMemo<
    Omit<ChartOptions<typeof data[number]>, "data">
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
          getValue: (data) => data.mrr,
          elementType: "line",
          min: 0,
          tickCount: 4,
          formatters: { tooltip: (value: number) => `$${value}` },
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
          data: [{ label: "MRR", data }],
        }}
      />
    </div>
  );
};

export const loader: LoaderFunction = ({ context }) => {
  const { paused } = parseRequestContext(context);
  if (paused) return { data: [] };
  return loadMRRAnalytics();
};

export default AnalyticsMRRPage;
