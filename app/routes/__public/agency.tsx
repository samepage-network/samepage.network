import React from "react";
import { Link, useLoaderData } from "@remix-run/react";
import MailIcon from "@heroicons/react/outline/MailIcon";
import CogIcon from "@heroicons/react/outline/CogIcon";
import RefreshIcon from "@heroicons/react/outline/RefreshIcon";
import CheckIcon from "@heroicons/react/outline/CheckIcon";
import ArrowRightIcon from "@heroicons/react/outline/ArrowRightIcon";
import ChevronLeftIcon from "@heroicons/react/solid/ChevronLeftIcon";
import ChevronRightIcon from "@heroicons/react/solid/ChevronRightIcon";

const AgencyPage = () => {
  const data = useLoaderData<{ buyLink: string; looms: string[] }>();
  const [currentLoom, setCurrentLoom] = React.useState(0);
  return (
    <div className="my-16 w-full">
      <div className="max-w-4xl m-auto">
        <h1 className="font-bold text-7xl w-full text-center mb-8 leading-tight">
          An engineering agency focused on extensions
        </h1>
        <h2 className="text-xl font-semibold text-center mb-8">
          Engineering subscriptions to make your business more productive.
        </h2>
        <Link
          to="#pricing"
          className="rounded-lg py-3 w-32 text-center bg-sky-800 text-white shadow-2xl mb-8 m-auto block font-bold"
        >
          See Plan
        </Link>
        <p className="font-semibold text-center mb-8 text-sm">
          Integrations & automations that work, guaranteed
        </p>
        <div>
          <img src="/images/agency/graphic.png" className="m-auto pl-3 my-4" />
        </div>
      </div>
      <div className="bg-tertiary py-16 w-full">
        <div className="max-w-4xl m-auto">
          <h1 className="font-bold text-6xl w-full text-center mb-8 leading-tight">
            Save time to focus on what matters
          </h1>
          <h2 className="text-xl text-justify mb-8">
            Our agency works hand-in-hand with your team to super charge any of
            the applications you are currently using to help save time where you
            are spending too much of it. Before you go searching for the next
            big SaaS tool or hire an engineer, see if SamePage could help
            augment your current tools to plug the missing features that you
            need to scale your business.
          </h2>
          <div className="flex justify-between gap-16">
            <div className="text-center">
              <div>
                <MailIcon width={64} height={64} className={"inline-block"} />
              </div>
              Subscribe to our plan & request as many features as you'd like.
            </div>
            <div className="text-center">
              <div>
                <CogIcon width={64} height={64} className={"inline-block"} />
              </div>
              Receive the functionality delivered via the SamePage ecosystem of
              extensions within a few business days.
            </div>
            <div className="text-center">
              <div>
                <RefreshIcon
                  width={64}
                  height={64}
                  className={"inline-block"}
                />
              </div>
              We'll revise on the functionality until you're 100% satisfied.
            </div>
          </div>
        </div>
      </div>
      <div className="py-16 w-full">
        <div className="max-w-4xl m-auto">
          <h1 className="font-bold text-6xl w-full text-center mb-8 leading-tight">
            Recent Work
          </h1>
          <h2 className="text-xl text-center mb-8">
            Reliable automations, customized to your needs.
          </h2>
          <div className="flex justify-between gap-16 relative h-96 items-center">
            <div className="hover:bg-gray-500 rounded-full hover:bg-opacity-25">
              <ChevronLeftIcon
                onClick={() =>
                  setCurrentLoom((currentLoom - 1) % data.looms.length)
                }
                height={64}
                width={64}
                className={"cursor-pointer"}
              />
            </div>
            <iframe
              src={`https://www.loom.com/embed/${data.looms[currentLoom]}`}
              frameBorder={0}
              allowFullScreen
              className="w-full h-full rounded-md"
            />
            <div className="hover:bg-gray-500 rounded-full hover:bg-opacity-25">
              <ChevronRightIcon
                onClick={() =>
                  setCurrentLoom((currentLoom + 1) % data.looms.length)
                }
                height={64}
                width={64}
                className={"cursor-pointer"}
              />
            </div>
          </div>
        </div>
      </div>
      <div id={"pricing"} className="bg-tertiary py-16">
        <div className="bg-sky-100 rounded shadow-md flex-1 flex flex-col max-w-xl my-16 m-auto">
          <div className="border-b border-b-black border-opacity-75 py-8 px-4 text-center">
            <h1 className="font-bold text-xl">Monthly</h1>
            <p className="opacity-50 mb-8 text-sm h-10">
              We handle all of your multi-app automation needs.
            </p>
            <p className="h-6" />
            <h2>
              <span>
                <span className="text-xl align-top">$</span>
                <span className="text-5xl">1000</span>
                <span className="text-xl align-bottom">/mo</span>
              </span>
            </h2>
          </div>
          <div className="p-4 flex-grow">
            {[
              "Features for any digital tool",
              "Integrations between your applications",
              "Unlimited requests",
              "Prioritized support",
              "Up to 1K Notebooks Connected",
              "Up to 1M Shared Pages",
              "Pause or cancel anytime",
            ].map((f) => (
              <div key={f}>
                <CheckIcon
                  color="green"
                  className="mr-4 inline-block h-6 w-6"
                />
                <span>{f}</span>
              </div>
            ))}
          </div>
          <div className="flex pt-8 justify-center items-center">
            <a
              className="rounded-full border cursor-pointer py-3 px-6 border-black hover:bg-sky-300 active:bg-sky-500"
              href={data.buyLink}
            >
              Get started <ArrowRightIcon className="h-6 w-6 inline-block" />
            </a>
          </div>
          <div className="flex pb-8 pt-4 justify-center items-center">
            <a
              className="no-underline border-b border-dashed border-b-black text-sm font-semibold"
              href={"https://cal.com/samepage/discovery"}
            >
              Book a call
            </a>
          </div>
        </div>
      </div>
      <div>
        <div className="m-auto max-w-md text-xl">
          We're so confident on the efficiency gains your business will
          experience, that we offer a{" "}
          <span className="font-bold">60-day money back guarantee</span> if you
          unsubscribe unsatisfied within the first two months of working
          together.
        </div>
      </div>
    </div>
  );
};

const BUY_LINKS = {
  development: "https://buy.stripe.com/test_8wMcP67Cc32I5Lq001",
  test: "https://buy.stripe.com/test_8wMcP67Cc32I5Lq001",
  production: "https://buy.stripe.com/9AQ9AEeaIdZKfpC001",
};

export const loader = () => {
  return {
    buyLink: BUY_LINKS[process.env.NODE_ENV],
    looms: [
      "9f124d41ca8a47f4b09bc6d268cb36b8",
      "4a2c816dd5de4e8587a6dcfa3650f150",
      "9f25ed5f5c3c49dea0e0f79a38665405",
    ],
  };
};

export default AgencyPage;
