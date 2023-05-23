import React from "react";
import parseCredentialsFromRequest from "../internal/parseCredentialsFromRequest";
import { ListRequests } from "../internal/types";
import { LoaderFunctionArgs, useLoaderData, redirect } from "react-router-dom";
import LinkWithSearch from "./LinkWithSearch";
import apiClient from "../internal/apiClient";

const RequestsTab: React.FC = () => {
  const data = useLoaderData() as Awaited<ReturnType<ListRequests>>;
  return (
    <div>
      <h1 className="font-bold mb-4 text-xl">Requests (Coming Soon!)</h1>
      <ul>
        {data.requests.map((rq) => (
          <li key={rq.uuid}>
            <LinkWithSearch
              to={rq.uuid}
              className="text-sky-400 hover:underline cursor-pointer"
            >
              <span>{rq.label}</span>
            </LinkWithSearch>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const loader = async (args: LoaderFunctionArgs) => {
  const result = parseCredentialsFromRequest(args);
  if (!result.auth) {
    return redirect("..?warning=not-logged-in");
  }
  return apiClient({
    method: "list-requests",
    notebookUuid: result.notebookUuid,
    token: result.token,
  }).catch((e) => {
    if (e.status === 401) {
      return redirect("..?warning=not-logged-in");
    }
    throw e;
  });
};

export default RequestsTab;
