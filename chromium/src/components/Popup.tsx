import React from "react";
import { Button, InputGroup, Label, Spinner } from "@blueprintjs/core";
import apiClient from "samepage/internal/apiClient";

type Notebook = {
  uuid: string;
  appName: string;
  workspace: string;
};

type SuccessData = { token: string; notebooks: Notebook[]; userId: string };

const AuthPanel = ({
  onSuccess,
}: {
  onSuccess: (data: SuccessData) => void;
}) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const disabled = !email || !password;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const onConnect = React.useCallback(() => {
    setLoading(true);
    apiClient<SuccessData>({
      method: "connect-device",
      email,
      password,
    })
      .then(onSuccess)
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
      });
  }, [setError, setLoading, onSuccess, email, password]);
  return (
    <div>
      {loading && (
        <div className="flex flex-col items-center absolute inset-0 bg-opacity-25 z-50">
          <Spinner size={32} />
        </div>
      )}
      <h1 className="text-lg font-normal">Log Into Your SamePage Account</h1>
      <Label className={"w-1/2"}>
        Email
        <InputGroup
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          type={"text"}
          name={"email"}
        />
      </Label>
      <Label className={"w-1/2"}>
        Password
        <InputGroup
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type={"password"}
          name={"password"}
        />
      </Label>
      <div className="flex items-center gap-8">
        <Button
          disabled={disabled}
          text={"Connect"}
          intent={"primary"}
          onClick={onConnect}
        />
        <span className="text-red-800">{error}</span>
      </div>
    </div>
  );
};

// TODO - Allow TW to pick up on extension classes
const Main = () => {
  const [currentTab, setCurrentTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [notebooks, setNotebooks] = React.useState<Notebook[]>([]);
  const [creds, setCreds] = React.useState<{ userId: string; token: string }>();
  const currentNotebook = notebooks[currentTab];

  React.useEffect(() => {
    chrome.storage.sync
      .get(["token", "userId"])
      .then((d) => {
        if (d.token && d.userId) {
          return apiClient<{ notebooks: Notebook[] }>({
            method: "login-device",
            token: d.token,
            userId: d.userId,
          }).then((r) => {
            setNotebooks(r.notebooks);
          });
        } else {
          return Promise.resolve();
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setLoading]);
  return (
    <div style={{ width: 480, height: 360 }}>
      {loading ? (
        <div className="m-auto" style={{ margin: "auto" }}>
          <Spinner size={64} />
        </div>
      ) : !notebooks.length ? (
        <div className="m-auto text-green-700" style={{ margin: "auto" }}>
          No Notebooks Connected to this Account... yet
        </div>
      ) : creds ? (
        <div className="flex">
          <div className="w-32" style={{ width: 128 }}>
            {notebooks.map((t, i) => (
              <div
                className={`capitalize cursor-pointer py-4 px-6 rounded-lg hover:bg-sky-400${
                  i === currentTab ? " bg-sky-200" : ""
                }`}
                style={{
                  textTransform: "capitalize",
                  cursor: "pointer",
                  padding: "16px 24px",
                  borderRadius: "12px",
                  background:
                    i === currentTab ? "rgb(186, 230, 253)" : "inherit",
                }}
                key={i}
                onClick={() => {
                  setCurrentTab(i);
                }}
              >
                <div>{t.appName}</div>
                <div>{t.workspace}</div>
              </div>
            ))}
          </div>
          <div
            className="flex-grow p-8 h-full"
            style={{ padding: 32, height: "100%" }}
          >
            <div className="py-2 flex flex-col gap-2">
              <Label>
                Notebook Universal ID
                <InputGroup
                  placeholder={"Notebook Universal ID"}
                  disabled
                  defaultValue={currentNotebook.uuid}
                />
              </Label>
              <Label>
                Token
                <InputGroup
                  placeholder={"Token"}
                  disabled
                  defaultValue={creds.token}
                  type={"password"}
                />
              </Label>
            </div>
          </div>
        </div>
      ) : (
        <AuthPanel
          onSuccess={(data) => {
            chrome.storage.sync.set({ token: data.token });
            setCreds({ token: data.token, userId: data.userId });
            setNotebooks(data.notebooks);
          }}
        />
      )}
    </div>
  );
};

export default Main;
