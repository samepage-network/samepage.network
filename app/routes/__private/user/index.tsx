import { Link, useLoaderData } from "@remix-run/react";
export { default as CatchBoundary } from "~/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import remixAppLoader from "~/data/remixAppLoader.server";
import Stripe from "stripe";
import ExternalLink from "~/components/ExternalLink";
import getStripePlans from "~/data/getStripePlans.server";
import getStripePlan from "~/data/getStripePlan.server";

const UPGRADES: Record<string, string> = {
  Hobby: "Professional",
  Professional: "Client",
};

const UserIndexPage: React.FunctionComponent = () => {
  const { isAdmin, plan, portal, nextPlan } = useLoaderData<{
    isAdmin: boolean;
    plan: string;
    portal: string;
    nextPlan?: { name: string; url: string };
  }>();
  return (
    <div className="py-8">
      {isAdmin ? (
        <Link
          to={"/admin"}
          className={"text-blue-700 underline mb-8 inline-block"}
        >
          Admin Dashboard
        </Link>
      ) : (
        <span />
      )}
      {/* clickable from the user button - may want to have the user button migrate here instead.
       <UserProfile /> 
      */}
      <p className="mb-4">
        <span className="font-bold">Plan:</span>
        <span> {plan}</span>
      </p>
      {nextPlan && (
        <p className="mb-4">
          To upgrade to a <b>{nextPlan.name}</b> plan,{" "}
          <ExternalLink href={nextPlan.url}>click here</ExternalLink>
        </p>
      )}
      <p className="mb-4">
        To view your billing information,{" "}
        {portal ? (
          <ExternalLink href={portal}>click here</ExternalLink>
        ) : (
          <span>
            please contact{" "}
            <ExternalLink href={"mailto:support@samepage.network"}>
              support@samepage.network
            </ExternalLink>{" "}
          </span>
        )}
      </p>
    </div>
  );
};

export const loader: LoaderFunction = (args) => {
  return remixAppLoader(args, async ({ userId }) => {
    const user = await import("@clerk/clerk-sdk-node").then((clerk) =>
      clerk.users.getUser(userId)
    );
    const isAdmin = user.emailAddresses.some((e) =>
      e.emailAddress?.endsWith("@samepage.network")
    );
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-11-15",
    });
    const portal = await stripe.billingPortal.configurations
      .list({ active: true })
      .then((p) => p.data[0]?.login_page?.url || "");
    const plan = await getStripePlan(user);
    const nextPlanName = UPGRADES[plan];
    const plans = await getStripePlans();
    const nextPlan = nextPlanName
      ? { name: nextPlanName, url: plans[nextPlanName] }
      : undefined;
    return { isAdmin, plan, portal, nextPlan };
  });
};

export default UserIndexPage;
