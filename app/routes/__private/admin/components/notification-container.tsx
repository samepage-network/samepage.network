import remixAdminLoader from "~/data/remixAdminLoader.server";
import NotificationContainer from "package/components/NotificationContainer";
import listNotebooks from "~/data/listNotebooks.server";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Select from "~/components/Select";
import { getSetting, setSetting } from "package/internal/registry";
import TextInput from "~/components/TextInput";
import React from "react";
import Button from "~/components/Button";
import dispatchAppEvent from "package/internal/dispatchAppEvent";

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
          options={data
            .map((d) => ({
              id: d.uuid,
              label: `${d.app} / ${d.workspace}`,
            }))
            .concat({ id: "", label: "None" })}
          onChange={(e) => setSetting("uuid", e as string)}
          defaultValue={""}
        />
        <TextInput
          name={"token"}
          onChange={(e) => setSetting("token", e.target.value)}
          defaultValue={defaultToken}
          label={"Token"}
        />
        <Button
          onClick={() =>
            dispatchAppEvent({ type: "connection", status: "CONNECTED" })
          }
        >
          Connect
        </Button>
      </div>
      <div className="relative">
        <div className="absolute top-4 right-4">
          <NotificationContainer />
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
