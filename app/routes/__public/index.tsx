import React, { useRef, useEffect, useState, useMemo } from "react";
import type { ActionFunction } from "@remix-run/node";
import { Link, useFetcher } from "@remix-run/react";
import { Subscribe } from "@dvargas92495/app/components/Landing";
import subscribeToConvertkitAction from "@dvargas92495/app/backend/subscribeToConvertkitAction.server";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import TextInput from "@dvargas92495/app/components/TextInput";
import Button from "@dvargas92495/app/components/Button";
import SuccessfulActionToast from "@dvargas92495/app/components/SuccessfulActionToast";
import AtJsonRendered from "package/components/AtJsonRendered";
import { InitialSchema } from "package/internal/types";
import Typed from "typed.js";

function getTranslateXY(element: Element) {
  if (typeof window === "undefined") return { translateX: 0, translateY: 0 };
  const style = window.getComputedStyle(element);
  const matrix = new DOMMatrixReadOnly(style.transform);
  return {
    translateX: matrix.m41,
    translateY: matrix.m42,
  };
}

const DEFAULT_AT_JSON: InitialSchema = {
  content:
    "The goal for today is to decide whether or not we should use SamePage\nWhat are the pros?\nLive editing across apps\nWe each could use our own app\nNo more import/export\nWhat are the cons?\nThe experience feels so native we don't even realize we're using it\nWe're always able to access our data\nWait, what are we waiting for??\n",
  annotations: [
    {
      start: 0,
      end: 70,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 1,
      },
    },
    {
      start: 70,
      end: 89,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 1,
      },
    },
    {
      start: 89,
      end: 114,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 2,
      },
    },
    {
      start: 114,
      end: 144,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 2,
      },
    },
    {
      start: 144,
      end: 166,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 2,
      },
    },
    {
      start: 166,
      end: 185,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 1,
      },
    },
    {
      start: 185,
      end: 253,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 2,
      },
    },
    {
      start: 253,
      end: 290,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 2,
      },
    },
    {
      start: 290,
      end: 328,
      type: "block",
      attributes: {
        viewType: "bullet",
        level: 2,
      },
    },
  ],
};

const SPLASH_APPS = [
  {
    title: "Roam Graph",
    style: {
      backgroundImage:
        "linear-gradient(135deg,#394B59 0%,#CED9E0 40%,#106BA3 80%)",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    cursorColor: "#106BA3",
  },
  {
    title: "LogSeq Graph",
    style: {
      backgroundImage:
        "linear-gradient(135deg,#002b36 0%,#094b5a 40%,#a4b5b6 80%)",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    cursorColor: "#a4b5b6",
  },
  {
    title: "Obsidian Vault",
    style: {
      backgroundImage:
        "linear-gradient(135deg,#1e1e1e 0%,#DADADA 40%,#a882ff 80%)",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    cursorColor: "#a882ff",
  },
  {
    title: "Second Brain",
    style: {
      backgroundImage:
        "linear-gradient(135deg,#f97316 0%,#6366f1 40%,#0ea5e9 80%)",
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
    },
    cursorColor: "#0ea5e9",
  },
];

const Home: React.FC = () => {
  const [isLaunched, setIsLaunched] = useState(false);
  const isLaunchedRef = useRef(false);
  const typedElRef = useRef<HTMLSpanElement>(null);
  const typedRef = useRef<Typed>();
  const [typedIndex, setTypedIndex] = useState(-1);
  const [cursorDone, setCursorDone] = useState(false);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && /^m$/i.test(e.key)) {
        const val = !isLaunchedRef.current;
        setIsLaunched((isLaunchedRef.current = val));
      }
    };
    document.addEventListener("keydown", listener);
    if (typedElRef.current)
      typedRef.current = new Typed(typedElRef.current, {
        strings: SPLASH_APPS.map((a) => a.title),
        typeSpeed: 100,
        backSpeed: 50,
        startDelay: 100,
        preStringTyped(arrayPos) {
          setTypedIndex(arrayPos);
        },
        onComplete() {
          setTimeout(() => setCursorDone(true), 5000);
        },
      });
    return () => {
      document.removeEventListener("keydown", listener);
      typedRef.current?.destroy();
    };
  }, [
    setIsLaunched,
    isLaunchedRef,
    typedElRef,
    typedRef,
    setTypedIndex,
    setCursorDone,
  ]);

  const fetcher = useFetcher();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (
      fetcher.data?.success &&
      formRef.current &&
      fetcher.type === "actionReload"
    ) {
      formRef.current.reset();
    }
  }, [formRef, fetcher]);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(
    typeof window === "undefined" ? 0 : window.scrollY
  );
  const scrollState = useMemo(() => {
    if (!step1Ref.current || !step2Ref.current || !step3Ref.current) return 0;
    if (scroll < step1Ref.current.offsetTop) {
      return 0;
    } else if (
      scroll <
      step1Ref.current.offsetTop + step1Ref.current.offsetHeight
    ) {
      return Math.ceil(
        (4 * (scroll - step1Ref.current.offsetTop)) /
          step1Ref.current.offsetHeight
      ); // 1-4
    } else if (
      scroll <
      step2Ref.current.offsetTop + step2Ref.current.offsetHeight
    ) {
      return (
        Math.ceil(
          (4 * (scroll - step2Ref.current.offsetTop)) /
            step2Ref.current.offsetHeight
        ) + 4
      ); // 5-8
    } else if (
      scroll <
      step3Ref.current.offsetTop + step3Ref.current.offsetHeight
    ) {
      return (
        Math.ceil(
          (4 * (scroll - step3Ref.current.offsetTop)) /
            step3Ref.current.offsetHeight
        ) + 8
      ); // 9-12
    } else {
      return 13;
    }
  }, [scroll, step1Ref, step2Ref, step3Ref]);
  const pageIconStyle = useMemo(() => {
    if (scrollState < 5 || !step2Ref.current) return { display: "none" };
    const step2Logos =
      step2Ref.current.querySelectorAll<HTMLDivElement>("div.logo");
    if (scrollState > 7) {
      const translation = getTranslateXY(step2Logos[0]);
      return {
        top: step2Logos[0].offsetTop + translation.translateY,
        left: step2Logos[0].offsetLeft + translation.translateY,
      };
    }
    const progress =
      (4 * (scroll - step2Ref.current.offsetTop)) /
        step2Ref.current.offsetHeight +
      5 -
      scrollState;
    const source = step2Logos[(scrollState - 5) % step2Logos.length];
    const target = step2Logos[(scrollState - 4) % step2Logos.length];
    const translationSource = getTranslateXY(source);
    const translationTarget = getTranslateXY(target);
    return {
      top:
        (target.offsetTop +
          translationTarget.translateY -
          source.offsetTop -
          translationSource.translateY) *
          progress +
        (source.offsetTop + translationSource.translateY) +
        source.offsetHeight / 2,
      left:
        (target.offsetLeft +
          translationTarget.translateX -
          source.offsetLeft -
          translationSource.translateX) *
          progress +
        (source.offsetLeft + translationSource.translateX) +
        source.offsetWidth / 2,
    };
  }, [step2Ref, scroll, scrollState]);
  const mockAtJson = useMemo((): InitialSchema => {
    if (scrollState < 9 || !step3Ref.current)
      return { content: "", annotations: [] };
    if (scrollState > 12) return DEFAULT_AT_JSON;
    const progress = Math.ceil(
      (500 * (scroll - step3Ref.current.offsetTop)) /
        step3Ref.current.offsetHeight
    );
    return {
      content: DEFAULT_AT_JSON.content.slice(0, progress),
      annotations: DEFAULT_AT_JSON.annotations
        .filter((a) => a.start < progress)
        .map((a) => ({ ...a, end: Math.min(progress, a.end) })),
    };
  }, [scrollState, scroll, step3Ref]);
  useEffect(() => {
    const scrollListener = () => {
      setScroll(window.scrollY);
    };
    document.addEventListener("scroll", scrollListener);
    return () => document.removeEventListener("scroll", scrollListener);
  }, [step1Ref]);
  return (
    <div className={"w-full"}>
      <div
        className={`flex flex-col justify-center items-center bg-opacity-25 bg-gradient-to-b from-sky-50 to-inherit -mt-32 h-[100vh]`}
      >
        <div className="max-w-5xl w-full">
          <h1 className="mt-4 mb-12 text-5xl font-bold">
            <style>{`.splash-title .typed-cursor {
  color: ${SPLASH_APPS[typedIndex]?.cursorColor};
${cursorDone ? "display: none;\n" : ""}}`}</style>
            <span className="leading-tight splash-title">
              Connect your{" "}
              <span ref={typedElRef} style={SPLASH_APPS[typedIndex]?.style} />
            </span>
          </h1>
          <h2 className={`font-normal mb-4 text-2xl italic max-w-2xl`}>
            {
              "Designed for native interaction, SamePage plugs right into your tool for thought to enable collaboration with other users - no matter what tool they are using."
            }
          </h2>
          {isLaunched ? (
            <Link to={"install"}>
              <Button>Install Now</Button>
            </Link>
          ) : (
            <fetcher.Form
              className="flex gap-8 items-center max-w-2xl"
              method="put"
              ref={formRef}
            >
              <TextInput
                placeholder="hello@example.com"
                name={"email"}
                label={"Email"}
                className={"flex-grow"}
              />
              <Button>Join The Waitlist</Button>
            </fetcher.Form>
          )}
          <SuccessfulActionToast
            message="Click the confirmation link in your email to confirm!"
            fetcher={fetcher}
          />
        </div>
      </div>
      <div className="h-[100vh] py-16 bg-gradient-to-b from-sky-50 to-inherit">
        <div className=" max-w-5xl m-auto">
          <h1 className="mb-16 font-bold text-5xl max-w-lg">
            Welcome to the{" "}
            <span className="text-indigo-800">Protocol for Thought</span>
          </h1>
          <h2 className={`font-normal mb-8 text-lg max-w-xl`}>
            {
              "Everyone has their own tool. SamePage brings them together. No matter what tool each member of your team is using, we're bringing collaboration back as SamePage can sync changes without anybody needing to leave their custom setup."
            }
          </h2>
          <div className="relative pb-[56.25%] h-0">
            <iframe
              src="https://www.loom.com/embed/9f124d41ca8a47f4b09bc6d268cb36b8"
              frameBorder={0}
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full"
            />
          </div>
        </div>
      </div>
      <div
        className="py-24 px-6 relative flex h-[300vh] items-center flex-col justify-start bg-gradient-to-b from-sky-50 to-inherit"
        ref={step1Ref}
      >
        <div className="sticky top-[10%] w-full max-w-6xl">
          <div className="flex w-full gap-16 h-[80vh]">
            <div className="flex flex-col max-w-xs">
              <h1 className="text-gray-500 text-opacity-75 text-4xl mb-4">1</h1>
              <h1 className="font-semibold text-4xl mb-6">
                Bring Your <span className="text-green-700">Own Tool</span>
              </h1>
              <p className="mb-6">
                Before you go off exporting your data to import into another new
                tool, plug your existing tools to the SamePage Network by
                installing the SamePage extension.
              </p>
            </div>
            <div className="flex-grow relative">
              <div
                className="h-[50vh] w-[50vh] absolute top-0 left-0"
                style={{
                  opacity: scrollState < 1 ? 0 : 1,
                  transition: "opacity 1000ms ease 0s",
                }}
              >
                <img
                  src={"/images/landing/step1-roam.png"}
                  className={"w-full h-full"}
                />
              </div>
              <div
                className="h-[50vh] w-[50vh] absolute top-1/2 -translate-y-1/2 right-0"
                style={{
                  opacity: scrollState < 2 ? 0 : 1,
                  transition: "opacity 1000ms ease 0s",
                }}
              >
                <img
                  src={"/images/landing/step1-logseq.png"}
                  className={"w-full h-full"}
                />
              </div>
              <div
                className="h-[50vh] w-[50vh] absolute bottom-0 left-1/4 origin-bottom -translate-x-1/4"
                style={{
                  opacity: scrollState < 3 ? 0 : 1,
                  transition: "opacity 1000ms ease 0s",
                }}
              >
                <img
                  src={"/images/landing/step1-obsidian.png"}
                  className={"w-full h-full"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="py-24 px-6 relative flex h-[300vh] items-center flex-col justify-start bg-gradient-to-b from-sky-50 to-inherit"
        ref={step2Ref}
      >
        <div className="sticky top-[10%] w-full max-w-6xl">
          <div className="flex w-full gap-16 h-[80vh]">
            <div className="flex-grow relative">
              <div
                className="h-[20vh] w-[20vh] absolute top-8 left-1/2 -translate-x-1/2 logo"
                style={{
                  opacity: scrollState < 4 ? 0 : 1,
                  transition: "opacity 1000ms ease 0s",
                }}
              >
                <img src={"/images/roam.png"} className={"w-full h-full"} />
              </div>
              <div
                className="h-[20vh] w-[20vh] absolute right-8 bottom-1/4 translate-y-1/4 logo"
                style={{
                  opacity: scrollState < 5 ? 0 : 1,
                  transition: "opacity 1000ms ease 0s",
                }}
              >
                <img src={"/images/logseq.png"} className={"w-full h-full"} />
              </div>
              <div
                className="h-[20vh] w-[20vh] absolute left-8 bottom-1/4 translate-y-1/4 logo"
                style={{
                  opacity: scrollState < 6 ? 0 : 1,
                  transition: "opacity 1000ms ease 0s",
                }}
              >
                <img
                  src={"/images/obsidian.jfif"}
                  className={"w-full h-full"}
                />
              </div>
              <div
                className="absolute text-6xl -translate-x-1/2 -translate-y-1/2"
                style={pageIconStyle}
              >
                📝
              </div>
            </div>
            <div className="flex flex-col max-w-xs">
              <h1 className="text-gray-500 text-opacity-75 text-4xl mb-4">2</h1>
              <h1 className="font-semibold text-4xl mb-6">
                Own Your <span className="text-orange-700">Own Data</span>
              </h1>
              <p className="mb-6">
                Create Shared pages{" "}
                <span className="font-bold">across applications</span> and
                control which notebooks have access to which data.
              </p>
              <p className="mb-6">
                All while being backed up by the decentralized web so that you
                don't need SamePage to access your data.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div
        className="py-24 px-6 relative flex h-[300vh] items-center flex-col justify-start bg-gradient-to-b from-sky-50 to-inherit"
        ref={step3Ref}
      >
        <div className="sticky top-[10%] w-full max-w-6xl">
          <div className="flex w-full gap-16 h-[80vh]">
            <div
              className="flex-grow relative rounded-lg shadow-lg p-4"
              style={{
                opacity: scrollState < 8 ? 0 : 1,
                transition: "opacity 1000ms ease 0s",
                background: "#002b36",
                color: "#a4b5b6",
              }}
            >
              <h1 className="text-lg font-normal">
                Meeting notes for {new Date().toLocaleDateString()}
              </h1>
              <AtJsonRendered {...mockAtJson} />
            </div>
            <div className="flex flex-col max-w-xs">
              <h1 className="text-gray-500 text-opacity-75 text-4xl mb-4">3</h1>
              <h1 className="font-semibold text-4xl mb-6">
                Stay on the <span className="text-sky-700">SamePage</span>
              </h1>
              <p className="mb-6">
                We are bringing collaboration{" "}
                <span className="font-bold">back</span> to the tools for thought
                space by letting users connect pages in their second brains to
                those in others - no matter the tool you each used.
              </p>
            </div>
            <div
              className="flex-grow relative rounded-lg shadow-lg p-4"
              style={{
                opacity: scrollState < 8 ? 0 : 1,
                transition: "opacity 1000ms ease 0s",
                background: "#1e1e1e",
                color: "#fff",
              }}
            >
              <h1 className="text-lg font-normal">
                Meeting notes for {new Date().toLocaleDateString()}
              </h1>
              <AtJsonRendered {...mockAtJson} />
            </div>
          </div>
        </div>
      </div>
      <div
        className={`flex justify-center bg-opacity-25 bg-inherit h-[calc(100vh-270px)] items-center`}
      >
        <div className="max-w-5xl w-full">
          <Subscribe
            title={
              <h2 className={`font-semibold mb-4 text-2xl italic`}>
                Join our waitlist below to stay up to date on all news
                surrounding SamePage!
              </h2>
            }
          />
          <p className="mt-8 font-semibold text-lg w-full text-center">
            Have another tool you'd like to see supported?{" "}
            <Link
              className="text-sky-500 underline hover:no-underline cursor-pointer"
              to={"feedback"}
            >
              Let us know!
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export const action: ActionFunction = async (args) => {
  if (args.request.method === "PUT") return subscribeToConvertkitAction(args);
  else return {};
};

export default Home;
