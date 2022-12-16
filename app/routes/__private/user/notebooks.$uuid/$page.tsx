import remixAppAction from "@dvargas92495/app/backend/remixAppAction.server";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import { ActionFunction, LoaderFunction } from "@remix-run/node";
import { useLoaderData, useMatches } from "@remix-run/react";
import AtJsonRendered from "package/components/AtJsonRendered";
import getSharedPageByUuidForUser from "~/data/getSharedPageByUuidForUser.server";
import getUserNotebookProfile from "~/data/getUserNotebookProfile.server";
import { useEffect, useState } from "react";
import PencilIcon from "@heroicons/react/outline/PencilIcon";
import Textarea from "@dvargas92495/app/components/Textarea";

const SingleNotebookPagePage = () => {
  const data =
    useLoaderData<Awaited<ReturnType<typeof getSharedPageByUuidForUser>>>();
  const matches = useMatches();
  const parentData = matches[3].data as Awaited<
    ReturnType<typeof getUserNotebookProfile>
  >;
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("page-change", { detail: data.title })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("page-remove", { detail: data.title })
      );
    };
  }, [data.title]);
  const [isContentEditing, setIsContentEditing] = useState(false);
  const [isAnnotationsEditing, setIsAnnotationsEditing] = useState(false);
  return (
    <div
      id={"samepage-page-view"}
      data-notebook-page-id={data.title}
      className={"bg-sky-100 rounded-lg shadow-lg p-4 h-full flex"}
    >
      <div className="flex-grow">
        <AtJsonRendered {...data.data} />
      </div>
      {parentData.notebook.app === "SamePage" && (
        <div className="w-64 h-full border-l border-dashed px-2 border-l-black">
          <h2 className="text-lg mb-2 font-semibold">
            Editing{" "}
            <span className="text-xs italic font-light">Coming soon...</span>
          </h2>
          <p>
            <PencilIcon
              className={`h-6 w-6 mr-2 inline-block cursor-pointer bg-opacity-60 hover:bg-gray-200 rounded-sm ${
                isContentEditing ? "bg-gray-400" : ""
              }`}
              onClick={() => setIsContentEditing(!isContentEditing)}
            />{" "}
            Content
          </p>
          {isContentEditing && (
            <Textarea className="font-mono" defaultValue={data.data.content} />
          )}
          <p>
            <PencilIcon
              className={`h-6 w-6 mr-2 inline-block cursor-pointer bg-opacity-60 hover:bg-gray-200 rounded-sm ${
                isAnnotationsEditing ? "bg-gray-400" : ""
              }`}
              onClick={() => setIsAnnotationsEditing(!isAnnotationsEditing)}
            />{" "}
            Annotations
          </p>
          {isAnnotationsEditing && (
            <ul>
              {data.data.annotations.map((a, i) => (
                <li key={i}>{a.type}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export const action: ActionFunction = (args) => {
  return remixAppAction(args, {});
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, ({ params, context: { requestId } }) =>
    getSharedPageByUuidForUser({
      uuid: params["uuid"] || "",
      page: params["page"] || "",
      requestId,
    })
  );
};

const Title = () => {
  const matches = useMatches();
  const data = matches[3].data as Awaited<
    ReturnType<typeof getUserNotebookProfile>
  >;
  const nestedData = matches[4].data as Awaited<
    ReturnType<typeof getSharedPageByUuidForUser>
  >;
  return data ? (
    <span className="normal-case">
      {data.notebook.app} / {data.notebook.workspace} / {nestedData.title}
    </span>
  ) : (
    "Notebook"
  );
};

export const handle = {
  Title,
};

export default SingleNotebookPagePage;
