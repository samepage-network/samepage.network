import parseCredentialsFromRequest from "../internal/parseCredentialsFromRequest";
import { ListWorkflows } from "../internal/types";
import { LoaderFunctionArgs, useLoaderData, redirect } from "react-router-dom";
import AtJsonRendered from "./AtJsonRendered";
import LinkWithSearch from "./LinkWithSearch";

const WorkflowsTab: React.FC = () => {
  const data = useLoaderData() as Awaited<ReturnType<ListWorkflows>>;
  return (
    <div>
      <h1 className="font-bold mb-4 text-xl">Workflows</h1>
      <ul>
        {data.workflows.map((wf) => (
          <li key={wf.uuid}>
            <LinkWithSearch
              to={wf.uuid}
              className="text-sky-400 hover:underline cursor-pointer"
            >
              <AtJsonRendered {...wf.title} />
            </LinkWithSearch>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const makeLoader =
  ({ listWorkflows }: { listWorkflows: ListWorkflows }) =>
  async (args: LoaderFunctionArgs) => {
    const result = parseCredentialsFromRequest(args);
    if (!result.auth) {
      return redirect("..?warning=not-logged-in");
    }
    return listWorkflows(result).catch((e) => {
      if (e.status === 401) {
        return redirect("..?warning=not-logged-in");
      }
      throw e;
    });
  };

export default WorkflowsTab;
