import { ActionFunction } from "@remix-run/node";
import axios from "axios";

const TAGS = {
  Subscribe: 3348758,
  SignUp: 3691658,
};

const FORMS = {
  AutoConfirm: 4922555,
  Standard: 3628547,
};

export const subscribe = async ({
  email,
  tag,
  form,
}: {
  email: string;
  tag: keyof typeof TAGS;
  form: keyof typeof FORMS;
}) =>
  process.env.NODE_ENV === "production"
    ? axios
        .post<{ subscription: { subscriber: { id: string } } }>(
          `https://api.convertkit.com/v3/forms/${FORMS[form]}/subscribe`,
          {
            api_key: process.env.CONVERTKIT_API_KEY,
            email,
            tags: [TAGS[tag]],
          }
        )
        .then((sub) => ({
          success: true as const,
          data: sub.data.subscription.subscriber.id,
        }))
        .catch((e) => ({ success: false as const, reason: e.message }))
    : // TODO - create a local mock endpoint
      { success: true as const, data: "subbed" };

const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");
  if (typeof email !== "string")
    throw new Response("Email is required", { status: 400 });
  return subscribe({ email, tag: "Subscribe", form: "Standard" });
};

export default action;
