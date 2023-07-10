import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import loadUserAnalytics from "~/data/loadUserAnalytics.server";
import { useMemo } from "react";
import { Chart, type ChartOptions } from "react-charts";
import parseRequestContext from "samepage/internal/parseRequestContext";

const AnalyticsIndexPage = () => {
  const { data } =
    useLoaderData<Awaited<ReturnType<typeof loadUserAnalytics>>>();
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
          getValue: (data) => data.users,
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
          data: [{ label: "Total Users", data }],
        }}
      />
    </div>
  );
};

export const loader: LoaderFunction = ({ context }) => {
  const { requestId, paused } = parseRequestContext(context);
  if (paused) return { data: [] };
  return loadUserAnalytics({
    requestId,
  });
};

export default AnalyticsIndexPage;
