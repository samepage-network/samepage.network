import remixAdminLoader from "@dvargas92495/app/backend/remixAdminLoader.server";
// import Button from "@dvargas92495/app/components/Button";
// import TextInput from "@dvargas92495/app/components/TextInput";
// import dispatchAppEvent from "package/internal/dispatchAppEvent";
import NotificationContainer from "package/components/NotificationContainer";
import listNotebooks from "~/data/listNotebooks.server";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Select from "@dvargas92495/app/components/Select";
import { getSetting, setSetting } from "package/internal/registry";
import TextInput from "@dvargas92495/app/components/TextInput";
import React from "react";

const NotificationContainerPage = () => {
  const { data } = useLoaderData<Awaited<ReturnType<typeof listNotebooks>>>();
  const defaultToken = React.useMemo(
    () => (typeof localStorage !== "undefined" ? getSetting("token") : ""),
    []
  );
  return (
    <>
      <div className={"mb-8"}>
        <Select
          name={"notebookUuid"}
          options={data.map((d) => ({
            id: d.uuid,
            label: `${d.app} / ${d.workspace}`,
          }))}
          onChange={(e) => setSetting("uuid", e as string)}
        />
        <TextInput
          name={"token"}
          onChange={(e) => setSetting("token", e.target.value)}
          defaultValue={defaultToken}
          label={"Token"}
        />
      </div>
      <div className="relative">
        <div className="absolute top-4 right-4">
          <NotificationContainer
            actions={{ accept: () => Promise.resolve() }}
          />
        </div>
      </div>
    </>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAdminLoader(args, ({ context: { requestId } }) =>
    listNotebooks(requestId)
  );
};

export default NotificationContainerPage;
