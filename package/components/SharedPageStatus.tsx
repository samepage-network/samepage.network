import {
  Button,
  Classes,
  Dialog,
  Drawer,
  DrawerSize,
  Icon,
  IconName,
  MaybeElement,
  Tooltip,
} from "@blueprintjs/core";
import { appsById } from "../internal/apps";
import React from "react";
import SharePageDialog from "./SharePageDialog";
import { Notebook, OverlayProps, Schema } from "../internal/types";
import Automerge from "automerge";
import apiClient from "../internal/apiClient";
import { app, workspace } from "../internal/registry";
import getLastLocalVersion from "../internal/getLastLocalVersion";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { parseAndFormatActorId } from "../internal/parseActorId";
import AtJsonRendered from "./AtJsonRendered";
import { load, deleteId, get } from "../utils/localAutomergeDb";
import binaryToBase64 from "../internal/binaryToBase64";

type GetLocalHistory = (
  notebookPageId: string
) => Promise<Automerge.State<Schema>[]>;

export type SharedPageStatusProps = {
  notebookPageId: string;
  portalContainer?: HTMLElement;
  defaultOpenInviteDialog?: boolean;
  onCopy?: (s: string) => void;
};

const parseTime = (s = 0) => new Date(s * 1000).toLocaleString();

const HistoryContent = ({
  getHistory,
  portalContainer,
}: {
  getHistory: () => ReturnType<GetLocalHistory>;
  portalContainer?: HTMLElement;
}) => {
  const [history, setHistory] = React.useState<
    Awaited<ReturnType<GetLocalHistory>>
  >([]);
  const [selectedChange, setSelectedChange] =
    React.useState<Automerge.State<Schema>>();
  React.useEffect(() => {
    getHistory().then(setHistory);
  }, [getHistory, setHistory]);
  return (
    <div className="flex flex-col-reverse text-gray-800 w-full border border-gray-800 overflow-auto justify-end">
      {history.map((l, index) => (
        <div
          key={index}
          className={"border-t border-t-gray-800 p-4 relative cursor-pointer"}
          onClick={() => {
            setSelectedChange(l);
          }}
        >
          <div className={"text-sm absolute top-2 right-2"}>{index}</div>
          <div>
            <span className={"font-bold"}>Action: </span>
            <span>{l.change.message}</span>
          </div>
          <div>
            <span className={"font-bold"}>Actor: </span>
            <span>{parseAndFormatActorId(l.change.actor)}</span>
          </div>
          <div>
            <span className={"font-bold"}>Date: </span>
            <span>{parseTime(l.change.time)}</span>
          </div>
        </div>
      ))}
      <Dialog
        title={`Viewing Change: ${parseTime(selectedChange?.change.time)}`}
        isOpen={!!selectedChange}
        onClose={() => setSelectedChange(undefined)}
        enforceFocus={false}
        autoFocus={false}
        portalContainer={portalContainer}
      >
        <div className={Classes.DIALOG_BODY}>
          <p>
            There are {selectedChange?.change.ops.length} operations in this
            change. Snapshot at this version:
          </p>
          {/* selectedChange?.change.ops.slice(0, 50).map((op) => {
            return <pre>{JSON.stringify(op)}</pre>;
          }) */}
          {selectedChange && <AtJsonRendered {...selectedChange.snapshot} />}
        </div>
      </Dialog>
    </div>
  );
};

const TooltipButtonOverlay = ({
  Overlay = () => <div />,
  icon,
  portalContainer,
  tooltipContent,
  defaultIsOpen = false,
}: {
  Overlay?: (props: {
    isOpen: boolean;
    onClose: () => void;
    portalContainer?: HTMLElement;
  }) => React.ReactElement;
  icon?: IconName | MaybeElement;
  portalContainer?: HTMLElement;
  tooltipContent?: string | JSX.Element | undefined;
  defaultIsOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultIsOpen);
  return (
    <>
      <Tooltip content={tooltipContent} portalContainer={portalContainer}>
        <Button
          icon={icon}
          minimal
          disabled={isOpen}
          onClick={() => {
            setIsOpen(true);
          }}
        />
      </Tooltip>
      <Overlay
        onClose={() => setIsOpen(false)}
        isOpen={isOpen}
        portalContainer={portalContainer}
      />
    </>
  );
};

const SharedPageStatus = ({
  onClose,
  notebookPageId,
  portalContainer,
  defaultOpenInviteDialog,
  onCopy = (s) => window.navigator.clipboard.writeText(s),
}: OverlayProps<SharedPageStatusProps>) => {
  const [loading, setLoading] = React.useState(false);
  const containerRef = React.useRef<HTMLSpanElement>(null);
  return (
    <span
      className="samepage-shared-page-status flex gap-4 items-center text-lg mb-8 shadow-sm px-2 py-4"
      ref={containerRef}
    >
      <img
        src={"https://samepage.network/images/logo.png"}
        className={"h-8 w-8"}
      />
      <TooltipButtonOverlay
        defaultIsOpen={defaultOpenInviteDialog}
        tooltipContent={"Invite Notebook"}
        portalContainer={portalContainer}
        icon={"share"}
        Overlay={(props) => (
          <SharePageDialog
            {...props}
            notebookPageId={notebookPageId}
            removeOpenInvite={(app, workspace) =>
              apiClient({
                method: "remove-page-invite",
                notebookPageId,
                target: {
                  app,
                  workspace,
                },
              })
            }
            listConnectedNotebooks={(notebookPageId: string) =>
              Promise.all([
                apiClient<{
                  notebooks: {
                    app: string;
                    workspace: string;
                    version: number;
                    openInvite: boolean;
                    uuid: string;
                  }[];
                  recents: ({ uuid: string } & Notebook)[];
                }>({
                  method: "list-page-notebooks",
                  notebookPageId,
                }),
                load(notebookPageId),
              ]).then(([{ notebooks, recents }, doc]) => {
                return {
                  notebooks: notebooks.map((n) =>
                    n.workspace !== workspace || n.app !== appsById[app].name
                      ? n
                      : { ...n, version: getLastLocalVersion(doc) }
                  ),
                  recents,
                };
              })
            }
          />
        )}
      />
      <TooltipButtonOverlay
        tooltipContent={"View History"}
        portalContainer={portalContainer}
        icon={"history"}
        Overlay={(props) => (
          <Drawer
            {...props}
            title={"History"}
            position={"left"}
            hasBackdrop={false}
            size={DrawerSize.SMALL}
            canOutsideClickClose={false}
            portalClassName={"pointer-events-none"}
            className={"pointer-events-auto"}
          >
            <div className={Classes.DRAWER_BODY}>
              <HistoryContent
                getHistory={() =>
                  load(notebookPageId).then((doc) => Automerge.getHistory(doc))
                }
                portalContainer={portalContainer}
              />
            </div>
          </Drawer>
        )}
      />
      <Tooltip
        content={"Disconnect Shared Page"}
        portalContainer={portalContainer}
      >
        <Button
          disabled={loading}
          icon={"th-disconnect"}
          minimal
          onClick={() => {
            setLoading(true);
            return apiClient({
              method: "disconnect-shared-page",
              notebookPageId,
            })
              .then(() => {
                deleteId(notebookPageId);
                dispatchAppEvent({
                  type: "log",
                  content: `Successfully disconnected ${notebookPageId} from being shared.`,
                  id: "disconnect-shared-page",
                  intent: "success",
                });
                onClose();
              })
              .catch((e) => {
                setLoading(false);
                dispatchAppEvent({
                  type: "log",
                  content: `Failed to disconnect page ${notebookPageId}: ${e.message}`,
                  id: "disconnect-shared-page",
                  intent: "error",
                });
                return Promise.reject(e);
              });
          }}
        />
      </Tooltip>
      <Tooltip content={"Manual Sync"} portalContainer={portalContainer}>
        <Button
          disabled={loading}
          icon={"warning-sign"}
          minimal
          onClick={() => {
            setLoading(true);
            const doc = get(notebookPageId);
            apiClient({
              method: "force-push-page",
              notebookPageId,
              state: doc ? binaryToBase64(Automerge.save(doc)) : undefined,
            })
              .then(() =>
                dispatchAppEvent({
                  type: "log",
                  content: `All notebooks are synced!`,
                  id: "push-shared-page",
                  intent: "success",
                })
              )
              .catch((e) =>
                dispatchAppEvent({
                  type: "log",
                  content: `Failed to pushed page state to other notebooks: ${e.message}`,
                  id: "push-shared-page",
                  intent: "error",
                })
              )
              .finally(() => setLoading(false));
          }}
        />
      </Tooltip>
      <Tooltip content={"Copy IPFS Link"} portalContainer={portalContainer}>
        <Button
          style={{ width: 30 }}
          disabled={loading}
          icon={
            <Icon
              icon={
                <svg
                  width="18px"
                  height="18px"
                  viewBox="0 0 24 24"
                  role="img"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0 1.608 6v12L12 24l10.392-6V6zm-1.073 1.445h.001a1.8 1.8 0 0 0 2.138 0l7.534 4.35a1.794 1.794 0 0 0 0 .403l-7.535 4.35a1.8 1.8 0 0 0-2.137 0l-7.536-4.35a1.795 1.795 0 0 0 0-.402zM21.324 7.4c.109.08.226.147.349.201v8.7a1.8 1.8 0 0 0-1.069 1.852l-7.535 4.35a1.8 1.8 0 0 0-.349-.2l-.009-8.653a1.8 1.8 0 0 0 1.07-1.851zm-18.648.048 7.535 4.35a1.8 1.8 0 0 0 1.069 1.852v8.7c-.124.054-.24.122-.349.202l-7.535-4.35a1.8 1.8 0 0 0-1.069-1.852v-8.7a1.85 1.85 0 0 0 .35-.202z" />
                </svg>
              }
            />
          }
          minimal
          onClick={() => {
            setLoading(true);
            apiClient<{ cid: string }>({
              method: "get-ipfs-cid",
              notebookPageId,
            })
              .then(({ cid }) => {
                onCopy(`https://${cid}.ipfs.w3s.link`);
                dispatchAppEvent({
                  type: "log",
                  content: `Copied IPFS Link!`,
                  id: "copied-ipfs-link",
                  intent: "success",
                });
              })
              .catch((e) =>
                dispatchAppEvent({
                  type: "log",
                  content: `Failed to find IPFS link for page: ${e.message}`,
                  id: "copied-ipfs-failed",
                  intent: "error",
                })
              )
              .finally(() => setLoading(false));
          }}
        />
      </Tooltip>
    </span>
  );
};

export default SharedPageStatus;
