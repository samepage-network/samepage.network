import type { AppId } from "../types";
import React from "react";
import {
  Button,
  Classes,
  Dialog,
  Icon,
  Label,
  InputGroup,
  MenuItem,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import inviteNotebookToPage from "../utils/inviteNotebookToPage";
import APPS, { appIdByName, appsById } from "../internal/apps";
import getNodeEnv from "../internal/getNodeEnv";

export type ListConnectedNotebooks = (notebookPageId: string) => Promise<{
  notebooks: {
    app: string;
    workspace: string;
    version: number;
    openInvite: boolean;
  }[];
}>;

export type RemoveOpenInvite = (
  app: AppId,
  workspace: string
) => Promise<{ success: boolean }>;

const formatVersion = (s: number) =>
  s ? new Date(s * 1000).toLocaleString() : "unknown";

export type Props = {
  onClose: () => void;
  portalContainer?: HTMLElement;
  isOpen?: boolean;
  notebookPageId: string;
  listConnectedNotebooks: ListConnectedNotebooks;
  removeOpenInvite: RemoveOpenInvite;
};

const appOptions = getNodeEnv() === "test" ? APPS : APPS.slice(1);

const AppSelect = Select.ofType<AppId>();

const SharePageDialog = ({
  onClose,
  isOpen = true,
  portalContainer,
  listConnectedNotebooks,
  removeOpenInvite,
  notebookPageId,
}: Props) => {
  const [notebooks, setNotebooks] = React.useState<
    Awaited<ReturnType<ListConnectedNotebooks>>["notebooks"]
  >([]);
  const [currentApp, setCurrentApp] = React.useState<AppId>(1);
  const [currentworkspace, setCurrentWorkspace] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const onInvite = () => {
    if (currentworkspace) {
      setLoading(true);
      inviteNotebookToPage({
        notebookPageId,
        app: currentApp,
        workspace: currentworkspace,
      }).finally(() => setLoading(false));
      setNotebooks([
        ...notebooks,
        {
          workspace: currentworkspace,
          app: appsById[currentApp as AppId].name,
          version: 0,
          openInvite: true,
        },
      ]);
      setCurrentWorkspace("");
    }
  };
  const appSelectRef = React.useRef<Select<AppId>>(null);

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      listConnectedNotebooks(notebookPageId)
        .then((r) => {
          setNotebooks(r.notebooks);
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [setLoading, setError, isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      title={`Share Page on SamePage`}
      onClose={onClose}
      canOutsideClickClose
      canEscapeKeyClose
      isCloseButtonShown={false}
      autoFocus={false}
      portalContainer={portalContainer}
    >
      <div className={Classes.DIALOG_BODY}>
        {notebooks.map((g, i) => (
          <div
            key={`${g.app}/${g.workspace}`}
            className={"flex gap-4 items-center mb-1 justify-between"}
          >
            <span className={"flex-grow"}>
              {g.app}/{g.workspace}
            </span>
            <span>
              {g.openInvite ? (
                <Button
                  minimal
                  icon={"trash"}
                  onClick={() => {
                    setLoading(true);
                    removeOpenInvite(appIdByName[g.app], g.workspace)
                      .then(() =>
                        setNotebooks(notebooks.filter((_, j) => j !== i))
                      )
                      .finally(() => setLoading(false));
                  }}
                />
              ) : (
                <Tooltip
                  content={`Version: ${formatVersion(g.version)}`}
                  portalContainer={portalContainer}
                >
                  <Icon icon={"info-sign"} />
                </Tooltip>
              )}
            </span>
          </div>
        ))}
        <div className={"flex gap-4 items-center"}>
          <Label className={"w-28"}>
            App
            <AppSelect
              items={appOptions.map((a) => a.id)}
              onItemSelect={(e) => setCurrentApp(e)}
              itemRenderer={(item, { modifiers, handleClick }) => (
                <MenuItem
                  key={item}
                  text={appsById[item].name}
                  active={modifiers.active}
                  onClick={handleClick}
                />
              )}
              filterable={false}
              popoverProps={{
                minimal: true,
                captureDismiss: true,
                portalContainer,
                portalClassName: "samepage-invite-app",
              }}
              ref={appSelectRef}
            >
              <Button
                text={appsById[currentApp].name || "Unknown"}
                rightIcon="double-caret-vertical"
                onBlur={(e) => {
                  if (
                    e.relatedTarget !== null &&
                    !(e.relatedTarget as HTMLElement).closest?.(
                      ".samepage-invite-app"
                    )
                  ) {
                    appSelectRef.current?.setState({ isOpen: false });
                    e.stopPropagation();
                  }
                }}
              />
            </AppSelect>
          </Label>
          <Label className={"flex-grow"}>
            Workspace
            <InputGroup
              value={currentworkspace}
              onChange={(e) => setCurrentWorkspace(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && onInvite()}
              placeholder={`Enter ${appsById[currentApp].workspaceLabel}`}
            />
          </Label>
          <Button
            minimal
            icon={"plus"}
            disabled={!currentworkspace}
            onClick={onInvite}
          />
        </div>
        <span className="text-red-700">{error}</span>
        {loading && <Spinner size={16} />}
      </div>
    </Dialog>
  );
};

export default SharePageDialog;
