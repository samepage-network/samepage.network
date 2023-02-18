import type { Notebook } from "../internal/types";
import React from "react";
import {
  AnchorButton,
  Button,
  Classes,
  Dialog,
  Icon,
  MenuItem,
  Spinner,
  Tooltip,
} from "@blueprintjs/core";
import { MultiSelect, MultiSelect2 } from "@blueprintjs/select";
import inviteNotebookToPage from "../utils/inviteNotebookToPage";
// TODO - remove both of these fields when possible
import { appIdByName, appsById } from "../internal/apps";
import apiClient from "../internal/apiClient";

type RecentNotebook = {
  uuid: string;
  appName?: string;
} & Notebook;

export type ListConnectedNotebooks = (notebookPageId: string) => Promise<{
  notebooks: {
    app: string;
    workspace: string;
    version: number;
    openInvite: boolean;
    uuid: string;
  }[];
  recents: RecentNotebook[];
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

const MultiSelectComponent = MultiSelect2 || MultiSelect;

const SharePageDialog = ({
  onClose,
  isOpen = true,
  portalContainer,
  listConnectedNotebooks,
  notebookPageId,
}: Props) => {
  const [notebooks, setNotebooks] = React.useState<
    Awaited<ReturnType<ListConnectedNotebooks>>["notebooks"]
  >([]);
  const [recents, setRecents] = React.useState<RecentNotebook[]>([]);
  const [inviteQuery, setInviteQuery] = React.useState("");
  const [currentNotebooks, setCurrentNotebooks] = React.useState<
    RecentNotebook[]
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
          currentNotebooks
            .filter((n) => n.appName || appsById[n.app]?.name)
            .map((n) => ({
              ...n,
              openInvite: true,
              version: 0,
              app: n.appName || appsById[n.app]?.name,
            }))
        )
      );
      setRecents(
        recents.filter(
          (r) =>
            !currentNotebookUuids.has(r.uuid) && (r.appName || appsById[r.app])
        )
      );
    }
  };

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
      <div
        className={`${Classes.DIALOG_BODY} text-black`}
        // onKeyDown={(e) => e.stopPropagation()}
        // onPaste={(e) => e.stopPropagation()}
      >
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
                    apiClient({
                      method: "remove-page-invite",
                      notebookPageId,
                      target: g.uuid,
                    })
                      .then(() => {
                        setNotebooks(
                          notebooks.filter((n) => n.uuid !== g.uuid)
                        );
                        setRecents(
                          recents.concat({
                            uuid: g.uuid,
                            workspace: g.workspace,
                            app: appIdByName[g.app],
                            appName: g.app,
                          })
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
          <MultiSelectComponent<typeof recents[number]>
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
                        {a.appName || appsById[a.app]?.name}
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
                  {a.appName || appsById[a.app]?.name}
                </span>{" "}
                <span className="font-normal text-sm">{a.workspace}</span>
              </span>
            )}
            selectedItems={currentNotebooks}
            placeholder={"Enter notebook..."}
            itemPredicate={(Q, i) => {
              const q = Q.toLowerCase();
              return (
                i.workspace.toLowerCase().includes(q) ||
                `${i.appName || appsById[i.app]?.name} ${i.workspace}`
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
                autoFocus: true,
                className: "text-black",
              },
              className: "mt-2 text-black",
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
            popoverProps={{
              minimal: true,
              position: "bottom-left",
              portalContainer,
            }}
            onRemove={(item) =>
              setCurrentNotebooks(
                currentNotebooks.filter((n) => n.uuid !== item.uuid)
              )
            }
          />
          <Tooltip
            content={
              currentNotebooks.length
                ? "Invite"
                : "Must add notebooks before inviting"
            }
          >
            <AnchorButton
              minimal
              icon={"plus"}
              disabled={!currentNotebooks.length}
              onClick={onInvite}
            />
          </Tooltip>
        </div>
        <span className="text-red-700">{error}</span>
        {loading && <Spinner size={16} />}
      </div>
    </Dialog>
  );
};

export default SharePageDialog;
