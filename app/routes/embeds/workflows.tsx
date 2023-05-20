import WorkflowsTab, { makeLoader } from "package/components/WorkflowsTab";
import authenticateNotebook from "~/data/authenticateNotebook.server";
import listWorkflows from "../../data/listWorkflows.server";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
export default WorkflowsTab;

export const loader = makeLoader({
  listWorkflows: async (credentials) => {
    await authenticateNotebook(credentials);
    return listWorkflows(credentials);
  },
});
