import ExternalLink from "~/components/ExternalLink";
import CheckIcon from "@heroicons/react/solid/CheckIcon";
import ArrowRightIcon from "@heroicons/react/outline/ArrowRightIcon";
import { Link, useLoaderData } from "@remix-run/react";
import { LoaderArgs, LoaderFunction } from "@remix-run/node";
import getUserId from "~/data/getUserId.server";
import getStripePlans from "~/data/getStripePlans.server";

const Plan = ({
  title,
  base,
  description,
  features = [],
  link,
}: {
  title: string;
  base: number;
  description: string;
  features: string[];
  link: string;
}) => {
  const data = useLoaderData<Awaited<ReturnType<typeof loaderFunction>>>();
  return (
    <div className="bg-sky-100 rounded shadow-md flex-1 flex flex-col">
      <div className="border-b border-b-black border-opacity-75 py-8 px-4 text-center">
        <h1 className="font-bold text-xl">{title}</h1>
        <p className="opacity-50 mb-8 text-sm h-10">{description}</p>
        <p className="h-6" />
        <h2>
          {base > 0 ? (
            <span>
              <span className="text-xl align-top">$</span>
              <span className="text-5xl">{base}</span>
              <span className="text-xl align-bottom">/mo</span>
            </span>
          ) : (
            <span className="text-5xl">Free</span>
          )}
        </h2>
      </div>
      <div className="p-4 flex-grow">
        {features.map((f) => (
          <div key={f}>
            <CheckIcon color="green" className="mr-4 inline-block h-6 w-6" />
            <span>{f}</span>
          </div>
        ))}
      </div>
      <div className="flex py-8 justify-center items-center">
        {data.isLoggedIn && data.plans[title] ? (
          <ExternalLink
            className="rounded-full border cursor-pointer py-3 px-6 border-black hover:bg-sky-300 active:bg-sky-500 text-black no-underline"
            href={data.plans[title]}
          >
            Subscribe <ArrowRightIcon className="h-6 w-6 inline-block" />
          </ExternalLink>
        ) : (
          <Link
            className="rounded-full border cursor-pointer py-3 px-6 border-black hover:bg-sky-300 active:bg-sky-500"
            to={link}
          >
            Get started <ArrowRightIcon className="h-6 w-6 inline-block" />
          </Link>
        )}
      </div>
    </div>
  );
};

const PricingPage = () => {
  return (
    <div className="w-full max-w-7xl">
      <div className="flex gap-8 w-full my-8">
        <Plan
          title={"Hobby"}
          base={0}
          description={"For individuals curious about SamePage"}
          features={["3 Notebooks", "100 Shared Pages"]}
          link={"/install"}
        />
        <Plan
          title={"Professional"}
          base={10}
          description={"For professionals managing several personal workspaces"}
          features={["5 Notebooks", "1K Shared Pages"]}
          link={"/signup"}
        />
        <Plan
          title={"Client"}
          base={1000}
          description={"For organizations partnering with us"}
          features={[
            "1K Notebooks",
            "1M Shared Pages",
            "Unlimited requests",
            "Prioritized support",
          ]}
          link={"/signup"}
        />
      </div>
    </div>
  );
};

const loaderFunction = async (args: LoaderArgs) => {
  const isLoggedIn = await getUserId(args).then((id) => !!id);
  const plans = await getStripePlans();
  return {
    isLoggedIn,
    plans,
  };
};

export const loader: LoaderFunction = loaderFunction;

export default PricingPage;
