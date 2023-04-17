import getMeta from "~/components/getMeta";
import { SignUp } from "@clerk/remix";
import remixAuthedLoader from "~/data/remixAuthedLoader.server";
import { useLoaderData } from "@remix-run/react";
export { default as ErrorBoundary } from "~/components/DefaultErrorBoundary";

const SignUpPage: React.FC = () => {
  const { redirectUrl } = useLoaderData<{ redirectUrl: string }>();
  const signInUrl = redirectUrl ? `/login?redirect=${redirectUrl}` : "/login";
  return (
    <SignUp
      afterSignInUrl={redirectUrl}
      signInUrl={signInUrl}
    />
  );
};

export const loader = remixAuthedLoader;
export const meta = getMeta({ title: "Sign up" });
export default SignUpPage;
