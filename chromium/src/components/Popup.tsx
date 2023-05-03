import React from "react";
import { InputGroup, Label, Spinner } from "@blueprintjs/core";
import apiClient from "samepage/internal/apiClient";
import { useNavigate, MemoryRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/chrome-extension";

type Notebook = {
  uuid: string;
  appName: string;
  workspace: string;
};

const PopupDashboard = () => {
  const [currentTab, setCurrentTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [notebooks, setNotebooks] = React.useState<Notebook[]>([]);
  const [creds, setCreds] = React.useState<{
    notebookUuid: string;
    token: string;
  }>();
  const currentNotebook = notebooks[currentTab];
  React.useEffect(() => {
    apiClient<{
      notebooks: Notebook[];
      credentials: {
        notebookUuid: string;
        token: string;
      };
    }>({
      // @ts-ignore
      method: "get-notebook-credentials",
      origin: "TODO - get origin from current tab",
      // does a cookie automatically get sent?
    })
      .then((r) => {
        setNotebooks(r.notebooks);
        setCreds(r.credentials);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setLoading, setNotebooks]);
  return loading ? (
    <div className="m-auto" style={{ margin: "auto" }}>
      <Spinner size={64} />
    </div>
  ) : !notebooks.length ? (
    <div className="m-auto text-green-700" style={{ margin: "auto" }}>
      No Notebooks Connected to this Account... yet
    </div>
  ) : (
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
              background: i === currentTab ? "rgb(186, 230, 253)" : "inherit",
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
              defaultValue={creds?.token}
              type={"password"}
            />
          </Label>
        </div>
      </div>
    </div>
  );
};

const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";

// TODO - Allow TW to pick up on extension classes
const PopupMain = () => {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      navigate={(to) => navigate(to)}
    >
      <div style={{ width: 480, height: 360 }}>
        <Routes>
          <SignedOut></SignedOut>
          <SignedIn>
            <Route path={"/"} element={<PopupDashboard />} />
          </SignedIn>
        </Routes>
      </div>
    </ClerkProvider>
  );
};

const Popup = () => {
  return (
    <MemoryRouter>
      <PopupMain />
    </MemoryRouter>
  );
};

export default Popup;
