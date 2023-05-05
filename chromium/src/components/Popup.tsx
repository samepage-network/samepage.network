import React from "react";
import { InputGroup, Label, Spinner } from "@blueprintjs/core";
// import apiClient from "samepage/internal/apiClient";
import {
  useNavigate,
  Route,
  createMemoryRouter,
  createRoutesFromElements,
  RouterProvider,
} from "react-router-dom";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/chrome-extension";
import RootDashboard from "samepage/components/RootDashboard";
import SharedPagesTab from "package/components/SharedPagesTab";
import apiClient from "package/internal/apiClient";

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
    // apiClient<{
    //   notebooks: Notebook[];
    //   credentials: {
    //     notebookUuid: string;
    //     token: string;
    //   };
    // }>({
    //   // @ts-ignore
    //   method: "get-notebook-credentials",
    //   origin: "TODO - get origin from current tab",
    //   // does a cookie automatically get sent?
    // })
    //   .then((r) => {
    //     setNotebooks(r.notebooks);
    //     setCreds(r.credentials);
    //   })
    //   .finally(() => {
    //     setLoading(false);
    //   });
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
        <RootDashboard root="/" currentTab="" />
      </div>
    </ClerkProvider>
  );
};

const router = createMemoryRouter(
  createRoutesFromElements(
    <Route path={"/"} element={<PopupMain />}>
      <Route path={""} element={<PopupDashboard />} />
      <Route
        path={"shared-pages"}
        element={<SharedPagesTab />}
        loader={({ request }) => {
          console.log(request.headers, document.cookie);
          return apiClient({
            method: "list-shared-pages",
            // TODO - get notebookUuid from current tab
            notebookUuid: localStorage.getItem("notebookUuid") || undefined,
            // TODO - get token from current user
            token: localStorage.getItem("token") || undefined,
          });
        }}
      />
      <Route path={"workflows"} element={<PopupDashboard />} />
    </Route>
  )
);

const Popup = () => {
  return <RouterProvider router={router} />;
};

export default Popup;
