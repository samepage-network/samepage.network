import Button from "@dvargas92495/app/components/Button";
import TextInput from "@dvargas92495/app/components/TextInput";
import NotificationContainer, {
  notify,
} from "client/src/components/NotificationContainer";

const NotificationContainerPage = () => {
  return (
    <>
      <div className={"mb-8"}>
        <TextInput name={"title"} placeholder={"Title"} />
        <TextInput name={"description"} placeholder={"Description"} />
        <Button
          onClick={() =>
            notify({
              title:
                document.querySelector<HTMLInputElement>("input[name=title]")
                  ?.value || "None",
              description:
                document.querySelector<HTMLInputElement>(
                  "input[name=description]"
                )?.value || "None",
              buttons: ["accept"],
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
