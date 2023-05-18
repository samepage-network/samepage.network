import React from "react";
import { SamePageSchema } from "../internal/types";
import AtJsonRendered from "./AtJsonRendered";
import Button from "./Button";
import LinkWithSearch from "./LinkWithSearch";
import SharedPageStatus from "./SharedPageStatus";
import useNavigateWithSearch from "./useNavigateWithSearch";
import { useLoaderData } from "react-router-dom";

const SharedPageTab: React.FC = () => {
  const data = useLoaderData() as {
    auth: true;
    notebookPageId: string;
    title: SamePageSchema;
    credentials?:
      | {
          notebookUuid: string;
          token: string;
        }
      | undefined;
  };
  const navigate = useNavigateWithSearch();
  return (
    <div>
      <LinkWithSearch to={"/embeds/shared-pages"} className="mb-4 inline-block">
        <Button type={"button"}>Back</Button>
      </LinkWithSearch>
      {!("auth" in data) ? (
        <div>User is not authenticated. Log in to manage this page.</div>
      ) : (
        <div>
          <h1 className="mb-8 text-3xl mt-4">
            <AtJsonRendered {...data.title} />
          </h1>
          <SharedPageStatus
            notebookPageId={data.notebookPageId}
            onClose={() => navigate(`/embeds/shared-pages`)}
            credentials={data.credentials}
          />
        </div>
      )}
    </div>
  );
};

export default SharedPageTab;
