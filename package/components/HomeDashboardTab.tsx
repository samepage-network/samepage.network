import { Form, useLoaderData } from "react-router-dom";
import Button from "./Button";
import TextInput from "./TextInput";
import BaseInput from "./BaseInput";

const HomeDashboardTab = ({
  onLogOut,
  url,
}: {
  onLogOut: () => void;
  url: string;
}) => {
  const data = useLoaderData() as { auth: boolean };
  return (
    <div>
      <h1 className="font-bold mb-4 text-xl">SamePage Widget</h1>
      <div className="mb-2">
        This widget helps you manage all your SamePage related resources!
      </div>
      {!data.auth ? (
        <Form method={"post"}>
          <div className="mb-2">
            Log into your SamePage account to get started.
          </div>
          <TextInput
            name={"email"}
            label={"Email"}
            placeholder="support@samepage.network"
          />
          <BaseInput
            type={"password"}
            name={"password"}
            label={"Password"}
            placeholder="****************"
          />
          <input type="hidden" name="origin" value={url} />
          <Button>Log In</Button>
        </Form>
      ) : (
        <div>
          <div className="mb-2">
            Successfully logged in! Click on one of the resources on the left to
            get started.
          </div>
          <Button type={"button"} onClick={onLogOut}>
            Log Out
          </Button>
        </div>
      )}
    </div>
  );
};

export default HomeDashboardTab;
