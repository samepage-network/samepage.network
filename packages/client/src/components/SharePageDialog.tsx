import type { AppId } from "@samepage/shared";
import React, { useEffect, useState } from "react";
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
import { apps } from "../internal/registry";
import type sharePageWithNotebook from "../protocols/sharePageWithNotebook";
import apiClient from "../internal/apiClient";
import sendToNotebook from "../internal/sendToNotebook";
import dispatchAppEvent from "../internal/dispatchAppEvent";

type ListConnectedNotebooks = ReturnType<
  typeof sharePageWithNotebook
>["listConnectedNotebooks"];

const formatVersion = (s: number) =>
  s ? new Date(s * 1000).toLocaleString() : "unknown";

export type Props = {
  onClose: () => void;
  portalContainer?: HTMLElement;
  isOpen?: boolean;
  notebookPageId: string;
  listConnectedNotebooks: ListConnectedNotebooks;
};

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
  useEffect(() => {
    setLoading(true);
    listConnectedNotebooks(notebookPageId)
      .then((r) => {
        setNotebooks(r.notebooks);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [setLoading, setError]);

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
              items={Object.keys(apps).map((a) => Number(a) as AppId)}
              activeItem={currentApp}
              onItemSelect={(e) => setCurrentApp(e)}
              itemRenderer={(item, { modifiers, handleClick }) => (
                <MenuItem
                  key={item}
                  text={apps[item].name}
                  active={modifiers.active}
                  onClick={handleClick}
                />
              )}
              filterable={false}
              popoverProps={{
                minimal: true,
                captureDismiss: true,
                portalContainer,
              }}
            >
              <Button
                text={apps[currentApp]?.name || "Unknown"}
                rightIcon="double-caret-vertical"
              />
            </AppSelect>
          </Label>
          <Label style={{ flexGrow: 1 }}>
            Workspace
            <InputGroup
              value={currentworkspace}
              onChange={(e) => setCurrentWorkspace(e.target.value)}
            />
          </Label>
          <Button
            minimal
            icon={"plus"}
            disabled={!currentApp || !currentworkspace}
            onClick={() => {
              if (currentApp && currentworkspace) {
                setLoading(true);
                apiClient<{ exists: boolean; uuid: string }>({
                  method: "get-shared-page",
                  notebookPageId,
                  download: false,
                })
                  .then((r) => {
                    sendToNotebook({
                      target: {
                        app: currentApp,
                        workspace: currentworkspace,
                      },
                      operation: "SHARE_PAGE",
                      data: {
                        notebookPageId,
                        pageUuid: r.uuid,
                      },
                    });
                    dispatchAppEvent({
                      type: "log",
                      intent: "success",
                      id: "share-page-success",
                      content: `Successfully shared page! We will now await for the other notebook(s) to accept`,
                    });
                  })
                  .catch((e) => {
                    dispatchAppEvent({
                      type: "log",
                      intent: "error",
                      id: "share-page-failure",
                      content: `Failed to share page with notebooks: ${e.message}`,
                    });
                  })
                  .finally(() => setLoading(false));
                setNotebooks([
                  ...notebooks,
                  {
                    workspace: currentworkspace,
                    app: apps[currentApp as AppId].name,
                    version: 0,
                  },
                ]);
                setCurrentWorkspace("");
              }
            }}
          />
        </div>
        <span className="text-red-700">{error}</span>
        {loading && <Spinner size={16} />}
      </div>
    </Dialog>
  );
};

export default SharePageDialog;
