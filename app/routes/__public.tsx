import PublicLayout from "@dvargas92495/app/components/PublicLayout";
import type { LoaderFunction } from "@remix-run/node";
import getUserId from "@dvargas92495/app/backend/getUserId.server";

export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const Public: React.FC = () => (
  <PublicLayout isWaitlist pages={["docs", "view"]} />
);

export const loader: LoaderFunction = ({ request }) => {
  return getUserId(request).then((id) => !!id);
};
export default Public;
