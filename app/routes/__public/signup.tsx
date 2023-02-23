import getMeta from "~/components/getMeta";
import { SignUp } from "@clerk/remix";
import remixAuthedLoader from "~/data/remixAuthedLoader.server";

export const loader = remixAuthedLoader;
export const meta = getMeta({ title: "Sign up" });
export default SignUp;
