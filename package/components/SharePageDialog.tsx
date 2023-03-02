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
import getLastLocalVersion from "../internal/getLastLocalVersion";
import { workspace, app } from "../internal/registry";
import { load } from "../utils/localAutomergeDb";
import { AppId } from "../internal/types";

const formatVersion = (s: number) =>
  s ? new Date(s * 1000).toLocaleString() : "unknown";

export type Props = {
  onClose: () => void;
  portalContainer?: HTMLElement;
  isOpen?: boolean;
  notebookPageId: string;
};

type ConnectedNotebooks = {
  app: string;
  workspace: string;
  version: number;
  openInvite: boolean;
  uuid: string;
  email: string;
}[];

type RecentNotebook = {
  uuid: string;
  appName?: string;
  email?: string;
  app?: AppId;
  workspace: string;
};

const MultiSelectComponent = MultiSelect2 || MultiSelect;

const getApp = (r: RecentNotebook) =>
  r.appName ||
  (typeof r.app !== "undefined" ? appsById[r.app]?.name : "Unknown");

const SharePageDialog = ({
  onClose,
  isOpen = true,
  portalContainer,
  notebookPageId,
}: Props) => {
  const [notebooks, setNotebooks] = React.useState<ConnectedNotebooks>([]);
  const [recents, setRecents] = React.useState<RecentNotebook[]>([]);
  const [inviteQuery, setInviteQuery] = React.useState("");
  const [currentNotebooks, setCurrentNotebooks] = React.useState<
    RecentNotebook[]
  >([]);
  // TODO: Remove this - we need to rearchitect RecentNotebook to be either:
  // - a full notebook with email
  // - just an email
  const currentNotebookUuids = React.useMemo(
    () => new Set(currentNotebooks.map((n) => n.uuid || n.email)),
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
            email: n.email,
          }).then((notebook): ConnectedNotebooks[number] => {
            return {
              openInvite: true,
              version: 0,
              app: notebook.appName,
              email: n.email || "",
              workspace: notebook.workspace,
              uuid: notebook.uuid,
            };
          })
        )
      )
        .then((newNotebooks) => {
          setNotebooks(notebooks.concat(newNotebooks));
          setRecents(
            recents.filter(
              (r) =>
                !currentNotebookUuids.has(r.uuid) && getApp(r) !== "Unknown"
            )
          );
          setCurrentNotebooks([]);
        })
        .catch((e) => {
          setError(e.message);
        })
        .finally(() => setLoading(false));
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        apiClient<{
          notebooks: ConnectedNotebooks;
          recents: RecentNotebook[];
        }>({
          method: "list-page-notebooks",
          notebookPageId,
        }),
        load(notebookPageId),
      ])
        .then(([{ notebooks, recents }, doc]) => {
          return {
            notebooks: notebooks.map((n) =>
              n.workspace !== workspace || n.app !== appsById[app].name
                ? n
                : { ...n, version: getLastLocalVersion(doc) }
            ),
            recents,
          };
        })
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
      onClose={() => {
        setError("");
        onClose();
      }}
      canOutsideClickClose
      canEscapeKeyClose
      isCloseButtonShown={false}
      autoFocus={false}
      portalContainer={portalContainer}
    >
      <div
        className={`${Classes.DIALOG_BODY} text-black`}
        onKeyDown={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        {notebooks.map((g) => (
          <div
            key={`${g.app}/${g.workspace}`}
            className={"flex gap-4 items-center mb-2 justify-between"}
          >
            <span
              className={`flex-grow flex flex-col ${
                loading ? "text-opacity-50" : ""
              }`}
            >
              <span>
                <span className="font-bold text-base pr-2">{g.app}</span>
                <span className="font-normal text-sm">{g.workspace}</span>
              </span>
              <span className="text-xs italic">{g.email}</span>
            </span>
            <span>
              {g.openInvite ? (
                <Button
                  minimal
                  icon={"trash"}
                  aria-label={"trash"}
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
          <MultiSelectComponent<RecentNotebook>
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
                      <span className="font-bold text-base">{getApp(a)}</span>{" "}
                      <span className="font-normal text-sm">{a.workspace}</span>
                    </div>
                    <div>
                      <span className="italic text-xs opacity-50">
                        {a.email || a.uuid}
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
            tagRenderer={(a) => {
              const appName = getApp(a);
              return (
                <span>
                  {a.email && (
                    <span className="font-bold text-base pr-2">{a.email}</span>
                  )}
                  {appName && appName !== "Unknown" && (
                    <span className="font-bold text-base pr-2">{appName}</span>
                  )}
                  {a.workspace && (
                    <span className="font-normal text-sm">{a.workspace}</span>
                  )}
                </span>
              );
            }}
            selectedItems={currentNotebooks}
            placeholder={"Enter notebook or email..."}
            itemPredicate={(Q, i) => {
              const q = Q.toLowerCase();
              return (
                i.workspace.toLowerCase().includes(q) ||
                `${
                  i.appName ||
                  (typeof i.app !== "undefined"
                    ? appsById[i.app]?.name
                    : "Unknown")
                } ${i.workspace}`
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
            createNewItemFromQuery={(s) => {
              return s.includes("@")
                ? { email: s, uuid: "", appName: "", workspace: "" }
                : [];
            }}
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
              aria-label={"plus"}
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
