import type { AppId } from "../types";
import React, { useEffect, useRef, useState } from "react";
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
import APPS, { appsById } from "../internal/apps";
import getNodeEnv from "../internal/getNodeEnv";

export type ListConnectedNotebooks = (notebookPageId: string) => Promise<{
  networks: { app: string; workspace: string; version: number }[];
  notebooks: { app: string; workspace: string; version: number }[];
}>;

const formatVersion = (s: number) =>
  s ? new Date(s * 1000).toLocaleString() : "unknown";

export type Props = {
  onClose: () => void;
  portalContainer?: HTMLElement;
  isOpen?: boolean;
  notebookPageId: string;
  listConnectedNotebooks: ListConnectedNotebooks;
};

const appOptions = getNodeEnv() === "test" ? APPS : APPS.slice(1);

const AppSelect = Select.ofType<AppId>();

const SharePageDialog = ({
  onClose,
  isOpen = true,
  portalContainer,
  listConnectedNotebooks,
  notebookPageId,
}: Props) => {
  const [notebooks, setNotebooks] = useState<
    Awaited<ReturnType<ListConnectedNotebooks>>["notebooks"]
  >([]);
  const [currentApp, setCurrentApp] = useState<AppId>(1);
  const [currentworkspace, setCurrentWorkspace] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const onInvite = () => {
    if (currentApp && currentworkspace) {
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
        },
      ]);
      setCurrentWorkspace("");
    }
  };
  const appSelectRef = useRef<Select<AppId>>(null);

  useEffect(() => {
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
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginBottom: 4,
              justifyContent: "space-between",
            }}
          >
            <span style={{ flexGrow: 1 }}>
              {g.app}/{g.workspace}
            </span>
            <span>
              {g.version ? (
                <Tooltip
                  content={`Version: ${formatVersion(g.version)}`}
                  portalContainer={portalContainer}
                >
                  <Icon icon={"info-sign"} />
                </Tooltip>
              ) : (
                <Button
                  minimal
                  icon={"trash"}
                  onClick={() =>
                    setNotebooks(notebooks.filter((_, j) => j !== i))
                  }
                />
              )}
            </span>
          </div>
        ))}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Label style={{ maxWidth: "120px", width: "100%" }}>
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
          <Label style={{ flexGrow: 1 }}>
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
            disabled={!currentApp || !currentworkspace}
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
