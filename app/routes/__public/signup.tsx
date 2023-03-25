import getMeta from "~/components/getMeta";
import { SignUp } from "@clerk/remix";
import remixAuthedLoader from "~/data/remixAuthedLoader.server";
import { useSearchParams } from "@remix-run/react";

const SignUpPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const redirect = decodeURIComponent(searchParams.get("redirect") || "");
  const afterSignInUrl = redirect || "/install?refresh=true";
  const signInUrl = redirect ? `/signup?redirect=${redirect}` : "/login";
  return (
    <SignUp
      afterSignInUrl={decodeURIComponent(afterSignInUrl)}
      signInUrl={signInUrl}
    />
  );
};

export const loader = remixAuthedLoader;
export const meta = getMeta({ title: "Sign up" });
export default SignUpPage;
