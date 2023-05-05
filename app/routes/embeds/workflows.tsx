export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import { LoaderArgs, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import getMysql from "~/data/mysql.server";
import authenticateEmbed from "./_authenticateEmbed.server";
import LinkWithSearch from "package/components/LinkWithSearch";
import workflowsLoader from "./_workflowsLoader.server";
import AtJsonRendered from "dist/components/AtJsonRendered";

const WorkflowsEmbed = () => {
  const data = useLoaderData<Awaited<ReturnType<typeof workflowsLoader>>>();
  return (
    <div>
      {"auth" in data && (
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
      )}
    </div>
  );
};

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return redirect("/embeds");
  }
  const loaderData = await workflowsLoader(result);
  return { ...loaderData, auth: true };
};

export default WorkflowsEmbed;
