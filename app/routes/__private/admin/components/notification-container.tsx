import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
import NotificationContainer from "package/components/NotificationContainer";
import dispatchAppEvent from "package/internal/dispatchAppEvent";

const NotificationContainerPage = () => {
  return (
    <>
      <div className={"mb-8"}>
        <TextInput name={"pageUuid"} placeholder={"Global Id"} />
        <TextInput name={"notebookPageId"} placeholder={"Local Id"} />
        <Button
          onClick={() =>
            dispatchAppEvent({
              type: "share-page",
              notebookPageId:
                document.querySelector<HTMLInputElement>(
                  "input[name=notebookPageId]"
                )?.value || "None",
              pageUuid:
                document.querySelector<HTMLInputElement>("input[name=pageUuid]")
                  ?.value || "None",
              source: { app: 0, workspace: "main" },
            })
          }
        >
          Notify
        </Button>
      </div>
      <NotificationContainer actions={{ accept: () => Promise.resolve() }} />
    </>
  );
};

export default NotificationContainerPage;
