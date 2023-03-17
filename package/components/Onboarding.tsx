import {
  Button,
  Checkbox,
  Classes,
  Dialog,
  Icon,
  IconSize,
  InputGroup,
  Label,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import apiClient from "../internal/apiClient";
import { OverlayProps } from "../internal/types";
import React, { Fragment, useCallback } from "react";
import { app, appRoot, workspace } from "../internal/registry";
import { appsById } from "../internal/apps";

const PAGES = ["WELCOME", "SETUP", "CONNECT", "START", "COMPLETE"] as const;
type Page = typeof PAGES[number];
type OnSuccess = (s: { notebookUuid: string; token: string }) => void;

const ConnectNotebookPage = ({
  setPage,
  onSuccess,
}: {
  setPage: (s: Page) => void;
  onSuccess: OnSuccess;
}) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [termsOfUse, setTermsOfUse] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const disabled = !termsOfUse || !email || !password;
  const onConnect = useCallback(() => {
    setLoading(true);
    apiClient<{ notebookUuid: string; token: string }>({
      method: "add-notebook",
      email,
      password,
      app,
      workspace,
    })
      .then(({ notebookUuid, token }) => {
        onSuccess({ token, notebookUuid });
        setPage("COMPLETE");
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
      });
  }, [setError, setLoading, setPage, onSuccess, email, password]);
  return (
    <Fragment>
      {loading && (
        <div className="flex flex-col items-center absolute inset-0 bg-opacity-25 z-50">
          <Spinner size={32} />
        </div>
      )}
      <h1 className="text-lg font-normal">Add this notebook to your account</h1>
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
      <Checkbox
        checked={termsOfUse}
        onChange={(e) => setTermsOfUse((e.target as HTMLInputElement).checked)}
        labelElement={
          <span>
            I have read and agree to the{" "}
            <a
              href="https://samepage.network/terms-of-use"
              target={"_blank"}
              rel={"noopener"}
              className={"text-sky-400"}
            >
              Terms of Use
            </a>
          </span>
        }
      />
      <div className="flex items-center gap-8">
        <Button
          disabled={disabled}
          text={"Connect"}
          intent={"primary"}
          onClick={onConnect}
        />
        <Button
          text={"Back"}
          icon={"arrow-left"}
          onClick={() => setPage("SETUP")}
        />
        <span className="text-red-800">{error}</span>
      </div>
    </Fragment>
  );
};

const CreateNotebookPage = ({
  setPage,
  onSuccess,
}: {
  setPage: (s: Page) => void;
  onSuccess: OnSuccess;
}) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [termsOfUse, setTermsOfUse] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const onCreate = React.useCallback(() => {
    setLoading(true);
    apiClient<{ notebookUuid: string; token: string }>({
      method: "create-notebook",
      email,
      password,
      app,
      workspace,
    })
      .then(({ notebookUuid, token }) => {
        onSuccess({ notebookUuid, token });
        setPage("COMPLETE");
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
      });
  }, [setError, setLoading, setPage, onSuccess, email, password]);
  return (
    <Fragment>
      {loading && (
        <div className="flex flex-col items-center absolute inset-0 bg-opacity-25 z-50">
          <Spinner size={32} />
        </div>
      )}
      <h1 className="text-lg font-normal">
        Create an account to link this notebook
      </h1>
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
      <Checkbox
        checked={termsOfUse}
        onChange={(e) => setTermsOfUse((e.target as HTMLInputElement).checked)}
        labelElement={
          <span>
            I have read and agree to the{" "}
            <a
              href="https://samepage.network/terms-of-use"
              target={"_blank"}
              rel={"noopener"}
              className={"text-sky-400"}
            >
              Terms of Use
            </a>
          </span>
        }
      />
      <div className="flex items-center gap-8">
        <Button
          disabled={!termsOfUse || !email || !password || loading}
          text={"Create"}
          intent={"primary"}
          onClick={onCreate}
        />
        <Button
          disabled={loading}
          text={"Back"}
          icon={"arrow-left"}
          onClick={() => setPage("SETUP")}
        />
        <span className="text-red-800">{error}</span>
      </div>
    </Fragment>
  );
};

const CompletePage = ({ onClose }: { onClose: () => void }) => {
  return (
    <Fragment>
      <h1 className="text-lg font-normal">Congratulations! 🎉</h1>
      <p className="mb-4">
        Each time you log onto your notebook, you should be automatically
        connected to the SamePage Network. At any point, you can disconnect by
        entering the{" "}
        <code className="font-mono font-normal bg-gray-200 rounded-sm">
          Disconnect from SamePage Network
        </code>{" "}
        command and reconnect by entering the{" "}
        <code className="font-mono font-normal bg-gray-200 rounded-sm">
          Connect to SamePage Network
        </code>{" "}
        command.
      </p>
      <p className="flex-grow">
        Close this modal by clicking the{" "}
        <code className="font-mono font-normal bg-gray-200 rounded-sm">
          All Done
        </code>{" "}
        button below, and share your first page by entering the{" "}
        <code className="font-mono font-normal bg-gray-200 rounded-sm">
          Share Page on SamePage
        </code>{" "}
        command!
      </p>
      <Button text={"All Done"} intent={"primary"} onClick={onClose} />
    </Fragment>
  );
};

const Onboarding = ({
  isOpen,
  onClose,
  onSuccess,
  onCancel,
}: OverlayProps<{
  onSuccess: OnSuccess;
  onCancel: () => void;
}>) => {
  const [page, setPage] = React.useState<Page>(PAGES[0]);
  return (
    <Dialog
      title={"Welcome to SamePage"}
      isOpen={isOpen}
      onClose={() => {
        onClose();
        if (page !== "COMPLETE") {
          onCancel();
        }
      }}
      style={{ width: "100%", maxWidth: 800, height: "100%", maxHeight: 600 }}
      portalClassName={"samepage-onboarding-portal"}
      portalContainer={appRoot}
      enforceFocus={false}
    >
      <style>{`.samepage-onboarding-portal .bp4-dialog-container,
.samepage-onboarding-portal .bp3-dialog-container {
  height: 100%;
}`}</style>
      <div
        className={`${Classes.DIALOG_BODY} flex flex-col gap-2 items-center text-black`}
        onKeyDown={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        {page === "WELCOME" && (
          <Fragment>
            <div className="w-40 h-40">
              <img src="https://samepage.network/images/logo.png" />
            </div>
            <h1 className="text-xl font-semibold mb-4">Welcome to SamePage!</h1>
            <div className="mb-4 flex-grow max-w-sm m-auto">
              <p>
                You're about to connect your notebook to SamePage - the
                inter-app collaboration network.
              </p>
              <p className="mb-4">We're excited to have you!</p>
            </div>
            <Button
              text={"Get Started"}
              onClick={() => setPage("SETUP")}
              intent={"primary"}
            />
          </Fragment>
        )}
        {page === "SETUP" && (
          <Fragment>
            <h1 className="text-lg font-normal">New to SamePage?</h1>
            <div className="flex gap-4 items-center h-full">
              <div className="border-gray-400 rounded-lg border p-8 flex flex-col gap-2 items-center h-full flex-1">
                <Icon icon={"import"} size={32} />
                <p className="font-bold text-lg">
                  No, I already have another connected Notebook
                </p>
                <p className="text-gray-700 flex-grow">
                  Use your existing SamePage account to generate a new Notebook
                  Universal Id for this {appsById[app].name}{" "}
                  {appsById[app].workspaceLabel}.
                </p>
                <Button
                  text={"Add Another Notebook"}
                  onClick={() => setPage("CONNECT")}
                  intent={"primary"}
                  className={"mt-4"}
                />
              </div>
              <div className="border-gray-400 rounded-lg border p-8 flex flex-col gap-2 items-center h-full flex-1">
                <Icon icon={"plus"} size={32} />
                <p className="font-bold text-lg">Yes, let's get set up!</p>
                <p className="text-gray-700 flex-grow">
                  This will create a new Notebook Universal Id and attach it to
                  your Notebook.{" "}
                  <Tooltip
                    popoverClassName="w-96"
                    content={`A 'Notebook' is a SamePage concept represented by a workspace in a given app. For example, this ${appsById[app].name} ${appsById[app].workspaceLabel} is an example of a Notebook.`}
                  >
                    <Icon icon={"help"} size={IconSize.STANDARD * 0.75} />
                  </Tooltip>
                </p>
                <Button
                  text={"Start Notebook"}
                  onClick={() => setPage("START")}
                  intent={"primary"}
                  className={"mt-4"}
                />
              </div>
            </div>
          </Fragment>
        )}
        {page === "CONNECT" && (
          <ConnectNotebookPage setPage={setPage} onSuccess={onSuccess} />
        )}
        {page === "START" && (
          <CreateNotebookPage setPage={setPage} onSuccess={onSuccess} />
        )}
        {page === "COMPLETE" && <CompletePage onClose={onClose} />}
      </div>
    </Dialog>
  );
};

export default Onboarding;
