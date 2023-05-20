import React from "react";
import {
  Form,
  LoaderFunctionArgs,
  redirect,
  useLoaderData,
} from "react-router-dom";
import AtJsonRendered from "./AtJsonRendered";
import LinkWithSearch from "./LinkWithSearch";
import TextInput from "./TextInput";
import Button from "./Button";
import { ListSharedPages } from "../internal/types";
import parseCredentialsFromRequest from "package/internal/parseCredentialsFromRequest";

const SharedPagesTab: React.FC = () => {
  const data = useLoaderData() as Awaited<ReturnType<ListSharedPages>>;
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

export const makeLoader =
  ({ listSharedPages }: { listSharedPages: ListSharedPages }) =>
  async (args: LoaderFunctionArgs) => {
    const result = parseCredentialsFromRequest(args);
    if (!result.auth) {
      return redirect("..?warning=not-logged-in");
    }
    return listSharedPages(result).catch((e) => {
      if (e.status === 401) {
        return redirect("..?warning=not-logged-in");
      }
      throw e;
    });
  };

export default SharedPagesTab;
