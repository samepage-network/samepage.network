import { Link, useLoaderData } from "@remix-run/react";
export { default as CatchBoundary } from "@dvargas92495/app/components/DefaultCatchBoundary";
export { default as ErrorBoundary } from "@dvargas92495/app/components/DefaultErrorBoundary";
import type { LoaderFunction } from "@remix-run/node";
import remixAppLoader from "@dvargas92495/app/backend/remixAppLoader.server";
import Stripe from "stripe";
import ExternalLink from "@dvargas92495/app/components/ExternalLink";

const UserIndexPage: React.FunctionComponent = () => {
  const { isAdmin, plan, portal } = useLoaderData<{
    isAdmin: boolean;
    plan: string;
    portal: string;
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
      <p>
        <span className="font-bold">Plan:</span>
        <span> {plan}</span>
      </p>
      <p>
        To change your plan,{" "}
        {portal && plan !== "Hobby" ? (
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
    const stripeCustomerId = user.privateMetadata.stripeCustomerId as string;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2022-11-15",
    });
    const portal = stripeCustomerId
      ? await stripe.billingPortal.configurations
          .list({ active: true })
          .then((p) => p.data[0]?.login_page?.url || "")
      : "";
    const plan = stripeCustomerId
      ? await stripe.subscriptions
          .list({
            customer: stripeCustomerId,
          })
          .then((s) =>
            s.data.length
              ? stripe.products
                  .retrieve(s.data[0].items.data[0].price.product as string)
                  .then((p) => p.name)
              : "Hobby"
          )
      : "Hobby";
    return { isAdmin, plan, portal };
  });
};

export default UserIndexPage;
