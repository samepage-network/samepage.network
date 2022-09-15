import {
  Button,
  Classes,
  Dialog,
  Drawer,
  DrawerSize,
  IconName,
  MaybeElement,
  Tooltip,
} from "@blueprintjs/core";
import { appsById } from "../internal/apps";
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import SharePageDialog from "./SharePageDialog";
import { Annotation, OverlayProps, Schema } from "../types";
import Automerge from "automerge";
import getActorId from "../internal/getActorId";
import apiClient from "../internal/apiClient";
import { app, notebookPageIds, workspace } from "../internal/registry";
import getLastLocalVersion from "../internal/getLastLocalVersion";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { parseAndFormatActorId } from "../internal/parseActorId";

type GetLocalHistory = (
  notebookPageId: string
) => Promise<Automerge.State<Schema>[]>;

export type Props = {
  notebookPageId: string;
  portalContainer?: HTMLElement;
  defaultOpenInviteDialog?: boolean;

  loadState?: (notebookPageId: string) => Promise<Uint8Array>;
  removeState?: (notebookPageId: string) => Promise<unknown>;
};

const parseTime = (s = 0) => new Date(s * 1000).toLocaleString();

type AnnotationTree = (Annotation & { children: AnnotationTree })[];

const AnnotationRendered = ({
  annotation,
  content,
}: {
  annotation: AnnotationTree[number];
  content: string;
}): React.ReactElement => {
  const children = annotation.children
    .reduce(
      (p, c) => {
        const splitIndex = p.findIndex(
          (pp) => pp.start <= c.start && c.end <= pp.end
        );
        return [
          ...p.slice(0, splitIndex),
          ...[
            {
              el: content.slice(p[splitIndex].start, c.start),
              start: p[splitIndex].start,
              end: c.start,
            },
            {
              el: <AnnotationRendered annotation={c} content={content} />,
              start: c.start,
              end: c.end,
            },
            {
              el: content.slice(c.end, p[splitIndex].end),
              end: p[splitIndex].end,
              start: c.end,
            },
          ],
          ...p.slice(splitIndex + 1),
        ];
      },
      [
        {
          el: content.slice(annotation.start, annotation.end),
          start: annotation.start,
          end: annotation.end,
        },
      ] as { el: React.ReactNode; start: number; end: number }[]
    )
    .map((c) => c.el);
  return annotation.type === "block" ? (
    <div
      style={{ marginLeft: annotation.attributes.level * 8 }}
      className={"my-2"}
    >
      {children}
    </div>
  ) : annotation.type === "highlighting" ? (
    <span className="bg-yellow-300">{children}</span>
  ) : annotation.type === "bold" ? (
    <b className="font-bold">{children}</b>
  ) : annotation.type === "italics" ? (
    <i className="italics">{children}</i>
  ) : annotation.type === "link" ? (
    <a href={annotation.attributes.href}>{children}</a>
  ) : (
    <>{children}</>
  );
};

const HistoryContent = ({
  getHistory,
  portalContainer,
}: {
  getHistory: () => ReturnType<GetLocalHistory>;
  portalContainer?: HTMLElement;
}) => {
  const [history, setHistory] = useState<Awaited<ReturnType<GetLocalHistory>>>(
    []
  );
  const [selectedChange, setSelectedChange] =
    useState<Automerge.State<Schema>>();
  useEffect(() => {
    getHistory().then(setHistory);
  }, [getHistory, setHistory]);
  const selectedSnapshotTree = useMemo(() => {
    if (!selectedChange) return [];
    const tree: AnnotationTree = [];
    selectedChange.snapshot.annotations.forEach((anno) => {
      const insert = (annotations: AnnotationTree, a: Annotation) => {
        const parent = annotations.find(
          (an) => an.start <= a.start && an.end >= a.end
        );
        if (parent) {
          insert(parent.children, a);
        } else {
          annotations.push({ ...a, children: [] });
        }
      };
      insert(tree, anno);
    });
    return tree;
  }, [selectedChange]);
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
          {selectedSnapshotTree.map((annotation) => (
            <AnnotationRendered
              annotation={annotation}
              content={selectedChange?.snapshot.content.toString() || ""}
            />
          ))}
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
  const [isOpen, setIsOpen] = useState(defaultIsOpen);
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
  loadState = () => Promise.resolve(new Uint8Array(0)),
  removeState = Promise.resolve,
}: OverlayProps<Props>) => {
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const loadAutomergeDoc = useCallback(
    (notebookPageId: string) =>
      loadState(notebookPageId).then((state) =>
        Automerge.load<Schema>(state as Automerge.BinaryDocument, {
          actorId: getActorId(),
        })
      ),
    [loadState]
  );
  return (
    <span
      className="samepage-shared-page-status flex gap-4 items-center text-lg mb-8 shadow-sm px-2 py-4"
      ref={containerRef}
    >
      <i>Shared</i>
      <TooltipButtonOverlay
        defaultIsOpen={defaultOpenInviteDialog}
        tooltipContent={"Invite Notebook"}
        portalContainer={portalContainer}
        icon={"share"}
        Overlay={(props) => (
          <SharePageDialog
            {...props}
            notebookPageId={notebookPageId}
            listConnectedNotebooks={(notebookPageId: string) =>
              Promise.all([
                apiClient<{
                  notebooks: {
                    app: string;
                    workspace: string;
                    version: number;
                  }[];
                  networks: {
                    app: string;
                    workspace: string;
                    version: number;
                  }[];
                }>({
                  method: "list-page-notebooks",
                  notebookPageId,
                }),
                loadAutomergeDoc(notebookPageId),
              ]).then(([{ networks, notebooks }, doc]) => {
                return {
                  networks,
                  notebooks: notebooks.map((n) =>
                    n.workspace !== workspace || n.app !== appsById[app].name
                      ? n
                      : { ...n, version: getLastLocalVersion(doc) }
                  ),
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
          >
            <div className={Classes.DRAWER_BODY}>
              <HistoryContent
                getHistory={() =>
                  loadAutomergeDoc(notebookPageId).then((doc) =>
                    Automerge.getHistory(doc)
                  )
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
                removeState(notebookPageId);
                notebookPageIds.delete(notebookPageId);
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
      <Tooltip
        content={"Force Push Local Copy"}
        portalContainer={portalContainer}
      >
        <Button
          disabled={loading}
          icon={"warning-sign"}
          minimal
          onClick={() => {
            setLoading(true);
            loadState(notebookPageId)
              .then((state) =>
                apiClient({
                  method: "force-push-page",
                  notebookPageId,
                  state: window.btoa(
                    String.fromCharCode.apply(null, Array.from(state))
                  ),
                })
              )
              .then(() =>
                dispatchAppEvent({
                  type: "log",
                  content: `Successfully pushed page state to other notebooks.`,
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
    </span>
  );
};

export default SharedPageStatus;
