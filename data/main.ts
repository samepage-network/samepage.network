import base from "fuegojs/dist/base";
import schema from "./schema";

base({
  projectName: "samepage.network",
  emailDomain: "samepage.network",
  clerkDnsId: "l7zkq208u6ys",
  schema,
  variables: ["convertkit_api_key", "password_secret_key"],
});
