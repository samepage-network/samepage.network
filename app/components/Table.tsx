import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import React from "react";
import mixClasses from "./mixClasses";

const Table = ({
  activeRow,
  onRowClick,
  className,
  tableClassName,
  thClassName,
  theadClassName,
  getTrClassName = (index: number, isActive: boolean) =>
    `cursor-pointer ${
      isActive
        ? "bg-gray-500 hover:bg-gray-500"
        : index % 2 === 0
        ? "bg-gray-100"
        : "bg-gray-200"
    } hover:bg-gray-300 whitespace-pre-wrap`,
  getTdClassName = () => `p-3 border-2 border-gray-400`,
  renderCell = {},
}: {
  activeRow?: string;
  onRowClick?:
    | string
    | ((
        row: Record<string, unknown>,
        index: number,
        e: React.MouseEvent<HTMLTableRowElement, MouseEvent>
      ) => void);
  className?: string;
  tableClassName?: string;
  thClassName?: string;
  theadClassName?: string;
  getTrClassName?: (index: number, isActive: boolean) => string;
  getTdClassName?: (index: number) => string;
  renderCell?: Record<string, (value: unknown) => React.ReactNode>;
}) => {
  const {
    data = [],
    columns = [],
    count,
  } = useLoaderData<{
    columns: { Header: string; accessor: string }[];
    data: Record<string, string | number>[];
    count: number;
  }>();

  const [searchParams, setSearchParams] = useSearchParams();
  const index = Number(searchParams.get("index")) || 1;
  const size = Math.max(Number(searchParams.get("size")) || 10, data.length);
  const pageCount = Math.ceil(count / size);
  const navigate = useNavigate();

  return !data.length ? (
    <div className={mixClasses("w-full text-align-center", className)}>
      No Results Found
    </div>
  ) : (
    <div className={mixClasses("w-full", className)}>
      <table
        className={mixClasses(
          "border-2 border-sky-600 w-full mb-2",
          tableClassName
        )}
      >
        <thead className={theadClassName}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.accessor}
                className={mixClasses(
                  "border-b-2 border-b-orange-400 bg-sky-400 text-black font-bold cursor-pointer",
                  thClassName
                )}
              >
                {column.Header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            return (
              <tr
                key={row.uuid || row.id || index}
                className={getTrClassName(
                  index,
                  activeRow === (row.uuid || row.id || index)
                )}
                onClick={(e) =>
                  typeof onRowClick === "string"
                    ? navigate(
                        `${data[index][onRowClick]}${
                          Array.from(searchParams.keys()).length
                            ? `?${searchParams.toString()}`
                            : ""
                        }`
                      )
                    : onRowClick?.(data[index], index, e)
                }
              >
                {columns.map((cell, jndex) => {
                  const renderer = renderCell[cell.accessor];
                  const value = row[cell.accessor];
                  return (
                    <td key={cell.accessor} className={getTdClassName(jndex)}>
                      {renderer ? renderer(value) : value}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {pageCount > 1 && (
        <div className="w-full flex justify-between items-center">
          <div>
            <select
              value={size}
              onChange={(e) => {
                setSearchParams({
                  ...Object.fromEntries(searchParams),
                  size: e.target.value,
                });
              }}
              className={"rounded-lg"}
            >
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  Show {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setSearchParams({
                  ...Object.fromEntries(searchParams),
                  index: "1",
                })
              }
              disabled={index <= 1}
              className={"rounded-full hover:bg-gray-100 cursor-pointer p-1"}
            >
              {"<<"}
            </button>
            <button
              onClick={() =>
                setSearchParams({
                  ...Object.fromEntries(searchParams),
                  index: (index - 1).toString(),
                })
              }
              disabled={index <= 1}
              className={"rounded-full hover:bg-gray-100 cursor-pointer p-1"}
            >
              {"<"}
            </button>
            <button
              onClick={() =>
                setSearchParams({
                  ...Object.fromEntries(searchParams),
                  index: (index + 1).toString(),
                })
              }
              disabled={false}
              className={"rounded-full hover:bg-gray-100 cursor-pointer p-1"}
            >
              {">"}
            </button>
            <button
              onClick={() =>
                setSearchParams({
                  ...Object.fromEntries(searchParams),
                  index: pageCount.toString(),
                })
              }
              disabled={false}
              className={"rounded-full hover:bg-gray-100 cursor-pointer p-1"}
            >
              {">>"}
            </button>
            <span>
              Page{" "}
              <strong>
                {index} of {pageCount}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
