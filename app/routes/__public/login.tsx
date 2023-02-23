import React from "react";
import { SignIn } from "@clerk/remix";
import remixAuthedLoader from "~/data/remixAuthedLoader.server";
import getMeta from "~/data/getMeta.server";

const LoginPage: React.FC = () => <SignIn path="/login" />;

export const loader = remixAuthedLoader;
export const meta = getMeta({ title: "Log in" });
export default LoginPage;
