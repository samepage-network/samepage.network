import Title from "@dvargas92495/app/components/Title";
import Textarea from "@dvargas92495/app/components/Textarea";
import { useFetcher } from "@remix-run/react";
import { useRef, useEffect } from "react";
import Subtitle from "@dvargas92495/app/components/Subtitle";
import TextInput from "@dvargas92495/app/components/TextInput";
import Button from "@dvargas92495/app/components/Button";
import SuccessfulActionToast from "@dvargas92495/app/components/SuccessfulActionToast";
import submitToolRequest from "~/data/submitToolRequest.server";
import type { ActionFunction } from "@remix-run/node";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const FeedbackPage = () => {
  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (fetcher.data?.success && formRef.current) formRef.current.reset();
  }, [fetcher, formRef]);
  return (
    <div className="max-w-5xl w-full">
      <div>
        <Title>Want to connect another tool?</Title>
        <Subtitle>
          Fill out the form below to let us know which tool{" "}
          <span className="font-bold">you</span> use day to day and want to
          connect with the rest of your colleagues.
        </Subtitle>
        <fetcher.Form ref={formRef} method={"post"}>
          <div className="flex items-center w-full gap-16">
            <TextInput
              name={"email"}
              label={"Email"}
              className={"w-64"}
              placeholder={"hello@example.com"}
            />
            <TextInput
              name={"tool"}
              label={"Link to Tool"}
              className={"flex-grow"}
              placeholder={"https://roamresearch.com"}
            />
          </div>
          <Textarea
            name={"message"}
            label={"Message"}
            placeholder={
              "Tell us alittle bit about how you use the tool and with which other tools you are hoping to collaborate with ..."
            }
          />
          <Button>Request</Button>
        </fetcher.Form>
        <SuccessfulActionToast fetcher={fetcher} />
      </div>
    </div>
  );
};

export const action: ActionFunction = async (args) => {
  if (args.request.method === "POST") {
    const formData = await args.request.formData();
    return submitToolRequest({
      email: formData.get("email") as string,
      tool: formData.get("tool") as string,
      message: formData.get("message") as string,
    });
  } else return {};
};

export default FeedbackPage;
