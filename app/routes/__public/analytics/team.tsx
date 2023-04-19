import type { LoaderFunction } from "@remix-run/node";
import Table from "~/components/Table";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const TeamAnalyticsPage = () => {
  return (
    <div className="max-w-3xl w-full flex flex-col h-full gap-4">
      <p className="mb-4">
        SamePage compensates by offering employees <b>capped revenue shares.</b>{" "}
        The take home pay for each employee is calculated by multiplying
        SamePage's previous month revenue by their share, then taking the
        minimum of either that amount or the cap. This incentivizes employees to
        grow with the business, then after a certain point, look to expand their
        portfolio of work.
      </p>
      <p className="mb-4">
        Revenue shares are reevaluated at the end of every quarter.
      </p>
      <Table className={`flex-grow`} />
    </div>
  );
};

export const loader: LoaderFunction = () => {
  const data = [
    { name: "David Vargas", share: "50%", cap: "$84,000" },
    { name: "Michael Gartner", share: "25%", cap: "$16,800" },
  ];
  return {
    columns: [
      { Header: "Employee", accessor: "name" },
      { Header: "Revenue Share", accessor: "share" },
      { Header: "Monthly Cap", accessor: "cap" },
    ],
    count: data.length,
    data,
    error: "",
  };
};

export default TeamAnalyticsPage;
