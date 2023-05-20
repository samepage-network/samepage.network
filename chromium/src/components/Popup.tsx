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
import SharedPagesTab, {
  makeLoader as sharedPagesMakeLoader,
} from "samepage/components/SharedPagesTab";
import apiClient from "samepage/internal/apiClient";
import HomeDashboardTab, {
  makeLoader as homeMakeLoader,
  makeAction as homeMakeAction,
} from "samepage/components/HomeDashboardTab";
import DefaultErrorBoundary from "~/components/DefaultErrorBoundary";
import SharedPageTab from "samepage/components/SharedPageTab";

const SamePageContext = React.createContext<{
  // notebookUuid: string;
  // token: string;
  url: string;
}>({
  // notebookUuid: "",
  // token: "",
  url: "",
});

const SamePageProvider = () => {
  const [url, setUrl] = React.useState("");
  const session = useSession();
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (session.isLoaded) {
      chrome.tabs
        .query({
          active: true,
          lastFocusedWindow: true,
        })
        .then((tabs) => {
          const url = tabs[0].url || "";
          setUrl(url);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [setLoading, session.isSignedIn, session.isLoaded]);
  return loading ? (
    <div className="m-auto" style={{ margin: "auto" }}>
      <Spinner size={64} />
    </div>
  ) : (
    <SamePageContext.Provider value={{ url }}>
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
        index
        element={<HomeDashboardTabRoute />}
        loader={homeMakeLoader({
          authenticateNotebook: ({ requestId, ...args }) =>
            apiClient({
              method: "authenticate-notebook",
              ...args,
            }),
          listUserNotebooks: ({ requestId, ...args }) =>
            apiClient({ method: "list-user-notebooks", ...args }),
        })}
        action={homeMakeAction({
          authenticateUser: (args) =>
            apiClient({
              method: "authenticate-user",
              ...args,
            }),
        })}
      />
      <Route
        path={"shared-pages"}
        element={<SharedPagesTab />}
        loader={sharedPagesMakeLoader({
          listSharedPages: ({ requestId, ...args }) =>
            apiClient({
              method: "list-shared-pages",
              ...args,
            }),
        })}
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
