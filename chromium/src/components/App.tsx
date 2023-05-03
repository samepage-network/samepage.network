import React from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  ClerkProvider,
} from "@clerk/chrome-extension";
import { useNavigate, Routes, Route, MemoryRouter } from "react-router-dom";

const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || "";

// TODO - look into clerking this
const AppRoutes = () => {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      navigate={(to) => navigate(to)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          padding: "32px 0",
          height: "100%",
        }}
      >
        <style>{`html, body, #app { height: 100%; }`}</style>
        <div style={{ height: 160, width: 160 }}>
          <img
            src="https://samepage.network/images/logo.png"
            height={160}
            width={160}
          />
        </div>
        <h1>Welcome to SamePage</h1>
        <div style={{ maxWidth: 480 }}>
          <Routes>
            <Route
              path="/sign-up/*"
              element={
                <>
                  <p className="mb-8" style={{ marginBottom: 32 }}>
                    If you don't have a SamePage account, sign up to get
                    started.
                  </p>
                  <SignUp signInUrl="/" afterSignInUrl={"/"} />
                </>
              }
            />
            <Route
              path="/"
              element={
                <>
                  <SignedIn>
                    <p className="mb-8" style={{ marginBottom: 32 }}>
                      You're successfully logged in to SamePage on this browser!
                      You can navigate to a SamePage supported application to
                      get started:
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: "3rem",
                      }}
                      className="grid gap-12 grid-cols-3"
                    >
                      <a
                        href="https://notion.so"
                        className="flex flex-col"
                        style={{ display: "flex", flexDirection: "column" }}
                      >
                        <img
                          src={
                            "https://samepage.network/images/apps/notion.png"
                          }
                          className="w-12 h-12"
                          style={{ width: 48, height: 48 }}
                        />
                        <span>Notion</span>
                      </a>
                    </div>
                  </SignedIn>
                  <SignedOut>
                    <p className="mb-8" style={{ marginBottom: 32 }}>
                      If you have a SamePage account, sign in to get started.
                    </p>
                    <SignIn afterSignInUrl={"/"} signUpUrl={"/sign-up"} />
                  </SignedOut>
                </>
              }
            />
          </Routes>
        </div>
        <div style={{ flexGrow: 1 }} />
        <div>SamePage version {chrome.runtime.getManifest().version}</div>
      </div>
    </ClerkProvider>
  );
};

const App = () => {
  return (
    <MemoryRouter>
      <AppRoutes />
    </MemoryRouter>
  );
};

export default App;
