import Title from "@dvargas92495/app/components/Title";
import Textarea from "@dvargas92495/app/components/Textarea";
import { useFetcher, Link } from "@remix-run/react";
import { useRef, useEffect } from "react";
import Subtitle from "@dvargas92495/app/components/Subtitle";
import TextInput from "@dvargas92495/app/components/TextInput";
import Button from "@dvargas92495/app/components/Button";
import SuccessfulActionToast from "@dvargas92495/app/components/SuccessfulActionToast";
import submitToolRequest from "~/data/submitToolRequest.server";
import type { ActionFunction } from "@remix-run/node";
import ExternalLink from "@dvargas92495/app/components/ExternalLink";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";

const ROADMAP = [
  {
    src: "https://www.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png",
    href: "https://docs.google.com",
    title: "Google Docs",
  },
  {
    title: "Notion",
    src: "https://pbs.twimg.com/profile_images/1510138251889328128/mCjpYHqx_400x400.png",
    href: "https://www.notion.so",
  },
  {
    title: "Tana",
    src: "https://pbs.twimg.com/profile_images/1483023821485613058/m2jmm4id_400x400.jpg",
    href: "https://tana.inc",
  },
  {
    title: "Craft",
    src: "https://pbs.twimg.com/profile_images/1432688526324379649/iTg3dHjs_400x400.jpg",
    href: "https://www.craft.do",
  },
  {
    title: "RemNote",
    src: "https://pbs.twimg.com/profile_images/1441023905645404160/GY7_462m_400x400.jpg",
    href: "https://www.remnote.com/",
  },
  {
    title: "Subconscious",
    src: "https://subconscious.network/media/third_eye_holofoil_512.png",
    href: "https://subconscious.network/",
  },
  {
    title: "Napkin",
    src: "https://uploads-ssl.webflow.com/62278fe51e489db4234eb636/6229eac6883797924f1e04f8_napkin-logo.svg",
    href: "https://www.napkin.one",
  },
  {
    title: "", // "Scrintal",
    src: "https://pbs.twimg.com/profile_images/1450458908993232898/lBojcTQe_400x400.jpg",
    href: "https://www.scrintal.com",
  },
  {
    title: "", // "Siyuan",
    src: "https://b3log.org/siyuan/static/logo.svg",
    href: "https://github.com/siyuan-note/siyuan",
  },
  {
    title: "",
    src: "",
    href: "http://drummer.scripting.com/",
  },
];

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
        <fetcher.Form ref={formRef} method={"post"} className={"mb-12"}>
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
        <Subtitle>Tools on the roadmap...</Subtitle>
        <div className="flex items-center gap-8">
          {ROADMAP.filter((r) => r.title).map((r) => (
            <ExternalLink href={r.href}>
              <img src={r.src} className={"h-32 w-32"} title={r.title} />
            </ExternalLink>
          ))}
        </div>
        <p className="my-4">
          Visit our live{" "}
          <Link
            to={"/roadmap"}
            className={`text-sky-500 underline hover:no-underline active:text-sky-600 active:no-underline`}
          >
            Roadmap!
          </Link>
        </p>
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

export const handle = {
  mainClassName: "bg-gradient-to-b from-sky-50 to-inherit -mt-16 pt-32",
};

export default FeedbackPage;
