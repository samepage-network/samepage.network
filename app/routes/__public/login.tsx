import React from "react";
import { SignIn } from "@clerk/remix";
import remixAuthedLoader from "~/data/remixAuthedLoader.server";
import getMeta from "~/components/getMeta";
import { useLoaderData } from "@remix-run/react";
import NoClerk from "./_NoClerk";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const LoginPage: React.FC = () => {
  const { redirectUrl, clerk } = useLoaderData<{
    redirectUrl: string;
    clerk: boolean;
  }>();
  if (!clerk) {
    return <NoClerk />;
  }
  const signUpUrl = redirectUrl ? `/signup?redirect=${redirectUrl}` : "/signup";
  return (
    <SignIn path="/login" afterSignInUrl={redirectUrl} signUpUrl={signUpUrl} />
  );
};

export const loader = remixAuthedLoader;
export const meta = getMeta({ title: "Log in" });
export default LoginPage;
