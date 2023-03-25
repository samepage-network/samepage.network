import React from "react";
import { SignIn } from "@clerk/remix";
import remixAuthedLoader from "~/data/remixAuthedLoader.server";
import getMeta from "~/components/getMeta";
import { useSearchParams } from "@remix-run/react";

const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirect = decodeURIComponent(searchParams.get("redirect") || "");
  const afterSignInUrl = redirect || "/install?refresh=true";
  const signUpUrl = redirect ? `/signup?redirect=${redirect}` : "/signup";
  return (
    <SignIn
      path="/login"
      afterSignInUrl={decodeURIComponent(afterSignInUrl)}
      signUpUrl={signUpUrl}
    />
  );
};

export const loader = remixAuthedLoader;
export const meta = getMeta({ title: "Log in" });
export default LoginPage;
