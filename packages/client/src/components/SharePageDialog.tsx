import type { Notebook, AppId } from "@samepage/shared";
import React, { useCallback, useState } from "react";
import {
  Button,
  Classes,
  Dialog,
  Label,
  InputGroup,
  Intent,
  MenuItem,
} from "@blueprintjs/core";
import { Select } from "@blueprintjs/select";
import { apps } from "../internal/registry";

export type Props = {
  onClose: () => void;
  onSubmit: (p: { notebooks: Notebook[] }) => void | Promise<void>;
  portalContainer?: HTMLElement;
  isOpen?: boolean;
};

const AppSelect = Select.ofType<number>();

const SharePageDialog = ({
  onClose,
  isOpen = true,
  onSubmit,
  portalContainer,
}: Props) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [currentApp, setCurrentApp] = useState<number>(1);
  const [currentworkspace, setCurrentWorkspace] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const onClick = useCallback(() => {
    setLoading(true);
    Promise.resolve(onSubmit({ notebooks }))
      .then(onClose)
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [onSubmit, onClose, notebooks]);

  return (
    <Dialog
      isOpen={isOpen}
      title={`Share Page with Notebook`}
      onClose={onClose}
      canOutsideClickClose
      canEscapeKeyClose
      isCloseButtonShown={false}
      autoFocus={false}
      portalContainer={portalContainer}
    >
      <div className={Classes.DIALOG_BODY}>
        <p>
          Sharing this page means that all notebooks with access to it will be
          able to edit its child blocks.
        </p>
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
              {apps[g.app].name}/{g.workspace}
            </span>
            <Button
              minimal
              icon={"trash"}
              onClick={() => setNotebooks(notebooks.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Label style={{ maxWidth: "120px", width: "100%" }}>
            App
            <AppSelect
              items={Object.keys(apps).map((a) => Number(a))}
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
                setNotebooks([
                  ...notebooks,
                  { workspace: currentworkspace, app: currentApp as AppId },
                ]);
                setCurrentWorkspace("");
              }
            }}
          />
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span className="text-red-700">{error}</span>
          <Button text={"Cancel"} onClick={onClose} disabled={loading} />
          <Button
            text={"Send"}
            intent={Intent.PRIMARY}
            onClick={onClick}
            disabled={loading || !notebooks.length}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default SharePageDialog;
