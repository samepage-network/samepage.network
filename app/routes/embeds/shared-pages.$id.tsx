import { LoaderArgs } from "@remix-run/node";
import authenticateEmbed from "./_authenticateEmbed";
import getMysql from "~/data/mysql.server";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "@remix-run/react";
import Button from "~/components/Button";
import SharedPageStatus from "package/components/SharedPageStatus";

const SingleSharedPageEmbedPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();
  const backTo = `/embeds/shared-pages?auth=${searchParams.get("auth")}`;
  return (
    <div>
      <Link to={backTo}>
        <Button type={"button"}>Back</Button>
      </Link>
      <SharedPageStatus
        notebookPageId={params.id || ""}
        onClose={() => navigate(backTo)}
      />
    </div>
  );
};

export const loader = async (args: LoaderArgs) => {
  const result = await authenticateEmbed(args);
  if (!result.auth) {
    await getMysql(result.requestId).then((c) => c.end());
    return {
      auth: false as const,
    };
  }
  const cxn = await getMysql(result.requestId);
  await cxn.end();
  return {
    auth: true as const,
  };
};

export default SingleSharedPageEmbedPage;
