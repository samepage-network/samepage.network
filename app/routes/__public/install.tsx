import { useState, useEffect } from "react";
import { useSearchParams, Link, useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import OverlayImg from "~/components/OverlayImg";
import ExternalLink from "~/components/ExternalLink";
import listApps from "~/data/listApps.server";
import parseRemixContext from "~/data/parseRemixContext.server";
import { Octokit } from "@octokit/rest";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

type InstructionSteps = {
  title: string;
  children: "image" | "link";
  props?: Record<string, string>;
}[];

const Instruction = ({ code }: { code: string }) => {
  const { steps = [] } = useLoaderData<{ steps: InstructionSteps }>();
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
                src={`/images/install/${code}-live-${i + 1}.png`}
                {...(s.props || {})}
              />
            ) : s.children === "link" ? (
              <ExternalLink
                href={(s.props?.href || "").replace(/samepage\.network/, () =>
                  process.env.NODE_ENV === "production"
                    ? "samepage.network"
                    : "samepage.ngrok.io"
                )}
              >
                Connect
              </ExternalLink>
            ) : (
              s.children
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const InstallPage = () => {
  const { userApps } = useLoaderData<{
    userApps: Awaited<ReturnType<typeof listApps>>;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  // yes this is confusing. the search param is id but we want the more readable, `code`
  // one day, id will just be code
  const [selectedApp, setSelectedApp] = useState(
    searchParams.get("id") || searchParams.get("app") || userApps[0].code
  );
  const name = userApps.find((a) => a.code === selectedApp)?.name;
  useEffect(() => {
    if (searchParams.has("refresh")) {
      searchParams.delete("refresh");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="flex flex-col items-center max-w-4xl w-full mb-16">
      <div className="rounded-full border-sky-600 border mb-12 inline-flex items-center justify-center">
        {userApps.map(({ code, name, id }) => {
          const selected = selectedApp === code;
          return (
            <div
              onClick={() => {
                setSelectedApp(code);
                setSearchParams({ id: code });
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
      {name ? (
        <>
          <h1 className="font-bold text-3xl mb-8">
            Install SamePage in {name}
          </h1>
          <img
            // src={`/assets/${selectedApp}/logo.png`}
            src={`https://raw.githubusercontent.com/samepage-network/${selectedApp}-samepage/main/assets/logo.png`}
            width={300}
            height={300}
          />
          <div className="rounded-md shadow-xl mb-8 flex flex-col p-10 w-full">
            <Instruction code={selectedApp} />
          </div>
          <div className="italic text-sm mb-2">
            *Note: SamePage extensions are currently under{" "}
            <b className="font-bold">heavy</b> development and these extensions
            will update frequently. Do not use with sensitive data.
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
        </>
      ) : (
        <h1 className="font-bold text-3xl mb-8">
          Invalid app <code>{selectedApp}</code>. Please select from the list
          above
        </h1>
      )}
    </div>
  );
};

export const handle = {
  mainClassName: "bg-gradient-to-b from-sky-50 to-inherit -mt-16 pt-32",
};

export const loader: LoaderFunction = async ({ context, request }) => {
  const requestId = parseRemixContext(context).lambdaContext.awsRequestId;
  const apps = await listApps({ requestId });
  const userApps = apps.filter(
    (a) => a.id && (a.live || process.env.NODE_ENV !== "production")
  );
  const searchParams = new URL(request.url).searchParams;
  const selectedApp =
    searchParams.get("id") || searchParams.get("app") || userApps[0].code;
  const instructions = await new Octokit({
    baseUrl: process.env.OCTOKIT_URL,
  }).repos
    .getContent({
      owner: "samepage-network",
      repo: `${selectedApp}-samepage`,
      path: "package.json",
    })
    .then((json) => {
      return "type" in json.data && json.data.type === "file"
        ? json.data.content
        : undefined;
    })
    .then((content) => {
      return content
        ? JSON.parse(Buffer.from(content, "base64").toString()).samepage
            ?.install || {}
        : {};
    });
  return {
    userApps,
    ...instructions,
  };
};

export const headers = () => {
  return {
    "Cache-Control": "max-age=86400, stale-while-revalidate=3600", // 1 day, 1 hour
  };
};

export default InstallPage;
