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
import RootDashboard, {
  loader as rootLoader,
} from "samepage/components/RootDashboard";
import SharedPagesTab, {
  loader as sharedPagesLoader,
  action as sharedPagesAction,
} from "samepage/components/SharedPagesTab";
import HomeDashboardTab, {
  loader as homeLoader,
  action as homeAction,
} from "samepage/components/HomeDashboardTab";
import DefaultErrorBoundary from "~/components/DefaultErrorBoundary";
import SharedPageTab, {
  loader as sharedPageLoader,
} from "samepage/components/SharedPageTab";
import WorkflowsTab, {
  loader as workflowsLoader,
} from "samepage/components/WorkflowsTab";
import WorkflowTab, {
  loader as workflowLoader,
  action as workflowAction,
} from "package/components/WorkflowTab";

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
  const clerk = useClerk();
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
      <RootDashboard
        root="/"
        currentTab={window.location.pathname}
        onLogOut={() => {
          clerk.signOut();
        }}
      />
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
  const url = useContext(SamePageContext).url;
  return <HomeDashboardTab url={url} />;
};

const router = createMemoryRouter(
  createRoutesFromElements(
    <Route
      path={"/"}
      element={<PopupMain />}
      errorElement={<DefaultErrorBoundary />}
      loader={rootLoader}
    >
      <Route
        index
        element={<HomeDashboardTabRoute />}
        loader={homeLoader}
        action={homeAction}
      />
      <Route
        path={"shared-pages"}
        element={<SharedPagesTab />}
        loader={sharedPagesLoader}
        action={sharedPagesAction}
      >
        <Route
          path={":uuid"}
          element={<SharedPageTab />}
          loader={sharedPageLoader}
        />
      </Route>
      <Route
        path={"workflows"}
        element={<WorkflowsTab />}
        loader={workflowsLoader}
      >
        <Route
          path={":uuid"}
          element={<WorkflowTab />}
          loader={workflowLoader}
          action={workflowAction}
        />
      </Route>
      <Route path={"requests"} element={<div />}></Route>
      <Route path={"overlays"} element={<div />}></Route>
    </Route>
  )
);

const Popup = () => {
  return <RouterProvider router={router} />;
};

export default Popup;
