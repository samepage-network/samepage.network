import type { AppId, Notebook } from "../internal/types";
import React from "react";
import {
  Button,
  Classes,
  Dialog,
  Icon,
  MenuItem,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import { MultiSelect } from "@blueprintjs/select";
import inviteNotebookToPage from "../utils/inviteNotebookToPage";
import { appIdByName, appsById } from "../internal/apps";

export type ListConnectedNotebooks = (notebookPageId: string) => Promise<{
  notebooks: {
    app: string;
    workspace: string;
    version: number;
    openInvite: boolean;
    uuid: string;
  }[];
  recents: ({
    uuid: string;
  } & Notebook)[];
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

// const appOptions = getNodeEnv() === "test" ? APPS : APPS.slice(1);

// const AppSelect = Select.ofType<AppId>();

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
  const [recents, setRecents] = React.useState<
    Awaited<ReturnType<ListConnectedNotebooks>>["recents"]
  >([]);
  const [inviteQuery, setInviteQuery] = React.useState("");
  const [currentNotebooks, setCurrentNotebooks] = React.useState<
    ({ uuid: string } & Notebook)[]
  >([]);
  const currentNotebookUuids = React.useMemo(
    () => new Set(currentNotebooks.map((n) => n.uuid)),
    [currentNotebooks]
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const onInvite = () => {
    if (currentNotebooks?.length) {
      setLoading(true);
      Promise.all(
        currentNotebooks.map((n) =>
          inviteNotebookToPage({
            notebookPageId,
            notebookUuid: n.uuid,
          })
        )
      )
        .then(() => setCurrentNotebooks([]))
        .catch(() => {
          setNotebooks(
            notebooks.filter((n) => !currentNotebookUuids.has(n.uuid))
          );
          setRecents(currentNotebooks.concat(recents));
        })
        .finally(() => setLoading(false));
      setNotebooks(
        notebooks.concat(
          currentNotebooks.map((n) => ({
            ...n,
            openInvite: true,
            version: 0,
            app: appsById[n.app].name,
          }))
        )
      );
      setRecents(recents.filter((r) => !currentNotebookUuids.has(r.uuid)));
    }
  };
  // const appSelectRef = React.useRef<Select<AppId>>(null);

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      listConnectedNotebooks(notebookPageId)
        .then((r) => {
          setNotebooks(r.notebooks);
          setRecents(r.recents);
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
      <div className={`${Classes.DIALOG_BODY} text-black`}>
        {notebooks.map((g) => (
          <div
            key={`${g.app}/${g.workspace}`}
            className={"flex gap-4 items-center mb-2 justify-between"}
          >
            <span className={`flex-grow ${loading ? "text-opacity-50" : ""}`}>
              <span className="font-bold text-base">{g.app}</span>{" "}
              <span className="font-normal text-sm">{g.workspace}</span>
            </span>
            <span>
              {g.openInvite ? (
                <Button
                  minimal
                  icon={"trash"}
                  onClick={() => {
                    setLoading(true);
                    removeOpenInvite(appIdByName[g.app], g.workspace)
                      .then(() => {
                        setNotebooks(
                          notebooks.filter((n) => n.uuid !== g.uuid)
                        );
                        setRecents(
                          [
                            {
                              uuid: g.uuid,
                              workspace: g.workspace,
                              app: appIdByName[g.app],
                            },
                          ].concat(recents)
                        );
                      })
                      .finally(() => setLoading(false));
                  }}
                />
              ) : (
                <Tooltip
                  content={`Version: ${formatVersion(g.version)}`}
                  portalContainer={portalContainer}
                >
                  <Icon icon={"info-sign"} className={"px-2 py-1"} />
                </Tooltip>
              )}
            </span>
          </div>
        ))}
        <div className={"flex gap-4 items-center"}>
          <style>{`.samepage-notebook-select .bp3-popover-target, .samepage-notebook-select .bp4-popover-target {
  width: 100%;
}`}</style>
          <MultiSelect<typeof recents[number]>
            items={recents}
            className={"flex-grow samepage-notebook-select"}
            itemsEqual={(a, b) => a.uuid === b.uuid}
            itemRenderer={(a, props) => (
              <MenuItem
                key={a.uuid}
                selected={currentNotebookUuids.has(a.uuid)}
                onClick={props.handleClick}
                intent={"primary"}
                active={props.modifiers.active}
                disabled={props.modifiers.disabled}
                text={
                  <div className="text-black">
                    <div>
                      <span className="font-bold text-base">
                        {appsById[a.app].name}
                      </span>{" "}
                      <span className="font-normal text-sm">{a.workspace}</span>
                    </div>
                    <div>
                      <span className="italic text-xs opacity-50">
                        {a.uuid}
                      </span>
                    </div>
                  </div>
                }
              />
            )}
            noResults={
              <MenuItem
                disabled={true}
                text="No results."
                roleStructure="listoption"
              />
            }
            tagRenderer={(a) => (
              <span>
                <span className="font-bold text-base">
                  {appsById[a.app].name}
                </span>{" "}
                <span className="font-normal text-sm">{a.workspace}</span>
              </span>
            )}
            selectedItems={currentNotebooks}
            placeholder={"Enter notebook or email..."}
            itemPredicate={(Q, i) => {
              const q = Q.toLowerCase();
              return (
                i.workspace.toLowerCase().includes(q) ||
                `${appsById[i.app].name} ${i.workspace}`
                  .toLowerCase()
                  .includes(q)
              );
            }}
            query={inviteQuery}
            onQueryChange={(e) => {
              setInviteQuery(e);
            }}
            onItemSelect={(e) => {
              if (!currentNotebookUuids.has(e.uuid)) {
                setCurrentNotebooks(currentNotebooks.concat([e]));
                setInviteQuery("");
              }
            }}
            tagInputProps={{
              inputProps: {
                style: {
                  width: "unset",
                },
              },
              className: "mt-2",
              rightElement: currentNotebookUuids.size ? (
                <Button
                  icon={"cross"}
                  small
                  minimal
                  onClick={() => setCurrentNotebooks([])}
                  className={"self-center"}
                />
              ) : undefined,
            }}
            popoverProps={{ minimal: true, position: "bottom-left" }}
            onRemove={(item) =>
              setCurrentNotebooks(
                currentNotebooks.filter((n) => n.uuid !== item.uuid)
              )
            }
          />
          <Button
            minimal
            icon={"plus"}
            disabled={!currentNotebooks.length}
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
