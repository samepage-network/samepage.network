import APPS from "package/internal/apps";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "@remix-run/react";
import OverlayImg from "~/components/OverlayImg";
import ExternalLink from "~/components/ExternalLink";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const userApps = APPS.slice(1)
  .filter((a) => !a.development)
  .map(({ name }) => ({
    id: name.toLowerCase(),
    name,
  }));

type InstructionSteps = {
  title: string;
  children: "image" | React.ReactNode;
  props?: Record<string, string>;
}[];

const Instruction = ({
  id,
  steps,
}: {
  id: string;
  steps: InstructionSteps;
}) => {
  return (
    <div className="flex justify-between items-start gap-8 h-full">
      {steps.map((s, i) => (
        <div className="flex-1 flex flex-col h-44" key={i}>
          <h2 className="font-semibold text-xl mb-4">
            {i + 1}. {s.title}
          </h2>
          <div className="flex-grow flex flex-col justify-center items-center">
            {s.children === "image" ? (
              <OverlayImg
                src={`/images/install/${id}-live-${i + 1}.png`}
                {...(s.props || {})}
              />
            ) : s.children === "link" ? (
              <ExternalLink {...(s.props || {})}>Connect</ExternalLink>
            ) : (
              s.children
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const INSTRUCTIONS: Record<string, { steps: InstructionSteps }> = {
  samepage: { steps: [] },
  roam: {
    steps: [
      {
        title: "Open Roam Depot",
        children: "image",
      },
      {
        title: "Search SamePage",
        children: "image",
      },
      {
        title: "Install!",
        children: "image",
      },
    ],
  },
  logseq: {
    steps: [
      {
        title: `Go to plugins dashboard`,
        children: "image",
      },
      {
        title: `Go to marketplace`,
        children: "image",
      },
      {
        title: `Search SamePage!`,
        children: "image",
      },
    ],
  },
  obsidian: {
    steps: [
      {
        title: `Go to Settings`,
        children: "image",
      },
      {
        title: `Browse Community Plugins`,
        children: "image",
      },
      {
        title: `Enable SamePage!`,
        children: "image",
      },
    ],
  },
  notion: {
    steps: [
      {
        title: `Click here`,
        children: "link",
        props: {
          href: `https://api.notion.com/v1/oauth/authorize?client_id=1990c3a3-66ff-4a69-8d22-af684683daf5&response_type=code&owner=user&redirect_uri=https://${
            process.env.NODE_ENV === "production"
              ? "samepage.network"
              : "samepage-app.ngrok.io"
          }/oauth/notion`,
        },
      },
      {
        title: `Select Accessible Pages`,
        children: "image",
      },
    ],
  },
};

const InstallPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedApp, setSelectedApp] = useState(
    searchParams.get("id") || userApps[0].id
  );
  const name = userApps.find((a) => a.id === selectedApp)?.name;
  useEffect(() => {
    if (searchParams.has("refresh")) {
      searchParams.delete("refresh");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex flex-col items-center max-w-4xl w-full mb-16">
      <div className="rounded-full border-sky-600 border mb-12 inline-flex items-center justify-center">
        {userApps.map(({ id, name }) => {
          const selected = selectedApp === id;
          return (
            <div
              onClick={() => {
                setSelectedApp(id);
                setSearchParams({ id });
              }}
              key={id}
              className={`cursor-pointer py-2 px-4 first:rounded-l-full last:rounded-r-full ${
                selected ? "text-white bg-sky-600" : "text-sky-600 bg-white"
              }`}
            >
              {name}
            </div>
          );
        })}
      </div>
      <h1 className="font-bold text-3xl mb-8">Install SamePage in {name}</h1>
      <img src={`/images/${selectedApp}.png`} width={300} height={300} />
      <div className="rounded-md shadow-xl mb-8 flex flex-col p-10 w-full">
        <Instruction id={selectedApp} {...INSTRUCTIONS[selectedApp]} />
      </div>
      <div className="italic text-sm mb-2">
        *Note: SamePage extensions are currently under{" "}
        <b className="font-bold">heavy</b> development and these extensions will
        update frequently. Do not use with sensitive data.
      </div>
      <div className="italic text-sm mb-2 w-full">
        A more in depth guide on how to install SamePage is available{" "}
        <Link
          to={`/docs/applications/${selectedApp}`}
          className={`text-sky-500 underline hover:no-underline active:text-sky-600 active:no-underline`}
        >
          in our docs.
        </Link>
      </div>
    </div>
  );
};

export const handle = {
  mainClassName: "bg-gradient-to-b from-sky-50 to-inherit -mt-16 pt-32",
};

export const headers = () => {
  return {
    "Cache-Control": "max-age=86400, stale-while-revalidate=3600", // 1 day, 1 hour
  };
};

export default InstallPage;
