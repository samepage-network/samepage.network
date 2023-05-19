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
    <div className="flex flex-col items-start h-full">
      <div className="flex-grow w-full">
        {!("auth" in data) ? (
          <>User is not authenticated. Log in to manage this page.</>
        ) : (
          <>
            <h1 className="mb-8 text-3xl">
              <AtJsonRendered {...data.title} />
            </h1>
            <SharedPageStatus
              notebookPageId={data.notebookPageId}
              onClose={() => navigate(`../shared-pages`)}
              credentials={data.credentials}
            />
          </>
        )}
      </div>
      <LinkWithSearch to={"../shared-pages"} className="mb-4 inline-block">
        <Button type={"button"}>Back</Button>
      </LinkWithSearch>
    </div>
  );
};

export default SharedPageTab;
