import { ActionFunction, redirect } from "@remix-run/node";
import axios from "axios";

const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");
  if (!email) throw new Response("Email is required", { status: 400 });
  return axios
    .post<{ subscription: { subscriber: { id: string } } }>(
      `https://api.convertkit.com/v3/forms/${process.env.CONVERTKIT_FORM_ID}/subscribe`,
      {
        api_key: process.env.CONVERTKIT_API_KEY,
        email,
      }
    )
    .then(() => ({ success: true }))
    .catch((e) => ({ success: false, reason: e.message }));
};

export default action;
