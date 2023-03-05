import { ActionFunction } from "@remix-run/node";
import axios from "axios";

export const subscribe = async ({ email }: { email: string }) =>
  process.env.NODE_ENV === "production"
    ? axios
        .post<{ subscription: { subscriber: { id: string } } }>(
          `https://api.convertkit.com/v3/forms/3628547/subscribe`,
          {
            api_key: process.env.CONVERTKIT_API_KEY,
            email,
          }
        )
        .then((sub) => ({
          success: true as const,
          data: sub.data.subscription.subscriber.id,
        }))
        .catch((e) => ({ success: false as const, reason: e.message }))
    // TODO - create a local mock endpoint
    : { success: true as const, data: "subbed" };

const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");
  if (typeof email !== "string")
    throw new Response("Email is required", { status: 400 });
  return subscribe({ email });
};

export default action;
