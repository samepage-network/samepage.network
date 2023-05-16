import React, { useContext } from "react";
import { Spinner } from "@blueprintjs/core";
import {
  useNavigate,
  Route,
  createMemoryRouter,
  createRoutesFromElements,
  RouterProvider,
} from "react-router-dom";
import { ClerkProvider, useClerk, useSession } from "@clerk/chrome-extension";
import RootDashboard from "samepage/components/RootDashboard";
import SharedPagesTab from "samepage/components/SharedPagesTab";
import apiClient from "samepage/internal/apiClient";
import HomeDashboardTab from "samepage/components/HomeDashboardTab";
import DefaultErrorBoundary from "~/components/DefaultErrorBoundary";
import SharedPageTab from "samepage/components/SharedPageTab";

const SamePageContext = React.createContext<{
  notebookUuid: string;
  token: string;
  url: string;
}>({
  notebookUuid: "",
  token: "",
  url: "",
});

const SamePageProvider = () => {
  const [notebookUuid, setNotebookUuid] = React.useState("");
  const [token, setToken] = React.useState("");
  const [url, setUrl] = React.useState("");
  const session = useSession();
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (session.isLoaded) {
      if (session.isSignedIn) {
        session.session
          .getToken()
          .then(async (sessionToken) => {
            if (!sessionToken) return;
            const tabs = await chrome.tabs.query({
              active: true,
              lastFocusedWindow: true,
            });
            const url = tabs[0].url || "";
            const r = await apiClient<{
              notebooks: {
                notebookUuid: string;
                appName: string;
                workspace: string;
                token: string;
              }[];
            }>({
              method: "list-user-notebooks",
              url,
              sessionToken,
              sessionId: session.session.id,
            });
            const { notebookUuid, token } = r.notebooks[0];
            setNotebookUuid(notebookUuid);
            setToken(token);
            setUrl(url);
            // TODO - look into accessing from shared context https://github.com/remix-run/react-router/discussions/9564
            localStorage.setItem("notebookUuid", notebookUuid);
            localStorage.setItem("token", token);
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        localStorage.removeItem("notebookUuid");
        localStorage.removeItem("token");
        setLoading(false);
      }
    }
  }, [setLoading, setNotebookUuid, session.isSignedIn, session.isLoaded]);
  return loading ? (
    <div className="m-auto" style={{ margin: "auto" }}>
      <Spinner size={64} />
    </div>
  ) : (
    <SamePageContext.Provider value={{ notebookUuid, token, url }}>
      <RootDashboard root="/" currentTab={window.location.pathname} />
    </SamePageContext.Provider>
  );
};

const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";
const PopupMain = () => {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      navigate={(to) => navigate(to)}
    >
      <div style={{ width: 480, height: 360 }}>
        <SamePageProvider />
      </div>
    </ClerkProvider>
  );
};

const HomeDashboardTabRoute = () => {
  const clerk = useClerk();
  const url = useContext(SamePageContext).url;
  return (
    <HomeDashboardTab
      onLogOut={() => {
        localStorage.removeItem("notebookUuid");
        localStorage.removeItem("token");
        clerk.signOut();
      }}
      url={url}
    />
  );
};

const router = createMemoryRouter(
  createRoutesFromElements(
    <Route
      path={"/"}
      element={<PopupMain />}
      errorElement={<DefaultErrorBoundary />}
    >
      <Route
        path={""}
        element={<HomeDashboardTabRoute />}
        loader={() => {
          return {
            auth: !!localStorage.getItem("notebookUuid"),
          };
        }}
        action={({ request }) => {
          return fetch(request);
        }}
      />
      <Route
        path={"shared-pages"}
        element={<SharedPagesTab />}
        loader={() => {
          return apiClient({
            method: "list-shared-pages",
            notebookUuid: localStorage.getItem("notebookUuid") || undefined,
            token: localStorage.getItem("token") || undefined,
          });
        }}
      >
        <Route
          path={":uuid"}
          element={<SharedPageTab />}
          loader={({ params }) => {
            const credentials = {
              notebookUuid: localStorage.getItem("notebookUuid") || undefined,
              token: localStorage.getItem("token") || undefined,
            };
            // TODO - proper loader here
            return {
              notebookPageId: params.uuid,
              credentials,
              title: { content: params.uuid, annotations: [] },
            };
          }}
        />
      </Route>
      <Route path={"workflows"} element={<div />} />
    </Route>
  )
);

const Popup = () => {
  return <RouterProvider router={router} />;
};

export default Popup;
