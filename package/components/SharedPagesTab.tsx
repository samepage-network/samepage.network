import React from "react";
import { Form, useLoaderData } from "react-router-dom";
import AtJsonRendered from "./AtJsonRendered";
import LinkWithSearch from "./LinkWithSearch";
import TextInput from "./TextInput";
import Button from "./Button";
import { SamePageSchema } from "../internal/types";

const SharedPagesTab: React.FC = () => {
  const data = useLoaderData() as {
    pages: {
      linkUuid: string;
      title: SamePageSchema;
      notebookPageId: string;
    }[];
  };
  return (
    <div>
      <h1 className="font-bold mb-4 text-xl">Shared Pages</h1>
      <div className="mb-4">
        {/* TODO: import ViewSharedPages Modal Content here */}
        <ul>
          {data.pages.map((p) => (
            <li key={p.linkUuid} className="mb-2">
              <LinkWithSearch to={p.linkUuid} className="text-sky-400">
                <AtJsonRendered {...p.title} />
              </LinkWithSearch>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-semibold mb-3 text-lg">Share Page on SamePage</h2>
        <Form method="post">
          <TextInput label={"Search"} name={"title"} />
          <Button>Share</Button>
        </Form>
      </div>
    </div>
  );
};

export default SharedPagesTab;
