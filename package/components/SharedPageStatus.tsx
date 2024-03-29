import {
  AnchorButton,
  Classes,
  Dialog,
  Drawer,
  DrawerSize,
  Icon,
  IconName,
  Tooltip,
} from "@blueprintjs/core";
import React, { useEffect } from "react";
import SharePageDialog from "./SharePageDialog";
import { EncodeState, OverlayProps, Schema } from "../internal/types";
import Automerge from "automerge";
import apiClient from "../internal/apiClient";
import dispatchAppEvent from "../internal/dispatchAppEvent";
import { parseAndFormatActorId } from "../internal/parseActorId";
import AtJsonRendered from "./AtJsonRendered";
import { load, deleteId } from "../utils/localAutomergeDb";
import binaryToBase64 from "../internal/binaryToBase64";
import unwrapSchema from "../utils/unwrapSchema";
import DialogFooter from "./DialogFooter";
import changeState from "../utils/changeState";

type GetLocalHistory = (
  notebookPageId: string
) => Promise<Automerge.State<Schema>[]>;

export type SharedPageStatusProps = {
  notebookPageId: string;
  portalContainer?: HTMLElement;
  defaultOpenInviteDialog?: boolean;
  encodeState: EncodeState;
  onCopy?: (s: string) => void;
};

type SamePageHistory = {
  states: Automerge.State<Schema>[];
  date: number;
}[];

const parseTime = (s = 0) => new Date(s * 1000).toLocaleString();

const COLORS = [
  "rgb(74 222 128)",
  "rgb(248 113 113)",
  "rgb(96 165 250)",
  "rgb(250 204 21)",
  "rgb(192 132 252)",
  "rgb(45 212 191)",
  "rgb(148 163 184)",
  "rgb(251 146 60)",
  "rgb(244 114 182)",
  "rgb(251 113 133)",
  "rgb(52 211 153)",
  "rgb(56 189 248)",
  "rgb(251 191 36)",
  "rgb(232 121 249)",
  "rgb(168 162 158)",
  "rgb(167 139 250)",
];

const RestoreHistoryDialog = ({
  isOpen,
  onClose,
  portalContainer,
  time,
  notebookPageId,
  state,
}: {
  onClose: () => void;
  portalContainer?: HTMLElement;
  isOpen?: boolean;
  notebookPageId: string;
  state: Automerge.State<Schema>;
  time: string;
}) => {
  return (
    <Dialog
      title={`Restore this version?`}
      isOpen={isOpen}
      onClose={onClose}
      enforceFocus={false}
      autoFocus={false}
      portalContainer={portalContainer}
    >
      <div
        className={`${Classes.DIALOG_BODY} text-black`}
        onKeyDown={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        <p>Your current document will revert to the version from {time}</p>
      </div>
      <DialogFooter
        onClose={onClose}
        onSubmit={() =>
          apiClient({
            method: "restore-page-version",
            notebookPageId,
            state: binaryToBase64(Automerge.save(state)),
          })
        }
      />
    </Dialog>
  );
};

const HistoryContentEntry = ({
  notebookPageId,
  item,
  setSelectedChange,
  actorMap,
}: {
  notebookPageId: string;
  item: SamePageHistory[number];
  setSelectedChange: (c: Automerge.State<Schema>) => void;
  actorMap: Record<string, string>;
}) => {
  const [collapsed, setCollapsed] = React.useState(true);
  const colors = React.useRef<Record<string, string>>({});
  const actors = React.useMemo(
    () => Array.from(new Set(item.states.map((s) => s.change.actor))),
    [item]
  );
  const getColor = React.useCallback(
    (actor: string) =>
      colors.current[actor] ||
      (colors.current[actor] = COLORS[Object.keys(colors.current).length]),
    [colors]
  );
  const Entry = ({
    state,
    actors,
    children,
  }: {
    state?: Automerge.State<Schema>;
    actors: string[];
    children?: React.ReactNode;
  }) => {
    const [hovered, setHovered] = React.useState(false);
    const parsedTime = parseTime(state?.change?.time || item.date);
    return (
      <div
        className={`p-4 cursor-pointer relative border-b border-b-gray-400 border-b-opacity-50 ${
          hovered ? "bg-gray-100" : ""
        }`}
        onClick={(e) => {
          if (state) setSelectedChange(state);
          else setCollapsed(!collapsed);
          e.stopPropagation();
        }}
        onMouseOver={() => setHovered(true)}
        onMouseOut={() => setHovered(false)}
      >
        {hovered && (
          <div className="absolute top-2 right-2">
            <TooltipButtonOverlay
              tooltipContent="Restore this version"
              icon={"history"}
              Overlay={(props) => (
                <RestoreHistoryDialog
                  {...props}
                  time={parsedTime}
                  notebookPageId={notebookPageId}
                  state={state || item.states[0]}
                />
              )}
            />
          </div>
        )}
        <h3 className="font-bold mb-2">
          {parseTime(state?.change?.time || item.date)}
        </h3>
        {actors.map((actor) => (
          <div className="my-1 text-sm flex items-center gap-2" key={actor}>
            <span
              className="h-3 w-3 rounded-full mr-1 inline-block"
              style={{ background: getColor(actor) }}
            />
            <span>{actorMap[actor]}</span>
          </div>
        ))}
        {!state && (
          <div className="pl-6 italic text-xs">
            <Icon icon={collapsed ? "caret-right" : "caret-down"} size={12} />
            <span> {item.states.length} changes</span>
          </div>
        )}
        {children}
      </div>
    );
  };
  return (
    <Entry
      state={item.states.length > 1 ? undefined : item.states[0]}
      actors={actors}
    >
      {!collapsed && (
        <div className="pl-8">
          {item.states.map((state) => (
            <Entry
              state={state}
              key={state.change.hash}
              actors={[state.change.actor]}
            />
          ))}
        </div>
      )}
    </Entry>
  );
};

const THRESHOLD_IN_MS = 30 * 60;

const HistoryContent = ({
  getHistory,
  portalContainer,
  notebookPageId,
}: {
  getHistory: () => ReturnType<GetLocalHistory>;
  portalContainer?: HTMLElement;
  notebookPageId: string;
}) => {
  const [history, setHistory] = React.useState<SamePageHistory>([]);
  const [actorMap, setActorMap] = React.useState<Record<string, string>>({});
  const [selectedChange, setSelectedChange] =
    React.useState<Automerge.State<Schema>>();
  React.useEffect(() => {
    getHistory().then(async (_history) => {
      const output: SamePageHistory = [];
      const actorMap: Record<string, string> = {};
      await Promise.all(
        _history.reverse().map(async (h) => {
          if (
            !output.length ||
            output.slice(-1)[0].date - h.change.time > THRESHOLD_IN_MS
          ) {
            output.push({ states: [h], date: h.change.time });
          } else {
            const entry = output.slice(-1)[0];
            entry.states.push(h);
          }
          actorMap[h.change.actor] = await parseAndFormatActorId(
            h.change.actor
          );
        })
      );
      setHistory(output);
      setActorMap(actorMap);
    });
  }, [getHistory, setHistory, setActorMap]);
  return (
    <div className="flex flex-col text-gray-800 w-full overflow-auto justify-end">
      {history.map((l, index) => (
        <HistoryContentEntry
          key={index}
          item={l}
          setSelectedChange={setSelectedChange}
          actorMap={actorMap}
          notebookPageId={notebookPageId}
        />
      ))}
      <Dialog
        title={`Viewing Change: ${parseTime(selectedChange?.change.time)}`}
        isOpen={!!selectedChange}
        onClose={() => setSelectedChange(undefined)}
        enforceFocus={false}
        autoFocus={false}
        portalContainer={portalContainer}
      >
        <div
          className={`${Classes.DIALOG_BODY} text-black`}
          onKeyDown={(e) => e.stopPropagation()}
          onPaste={(e) => e.stopPropagation()}
        >
          <p>
            There are {selectedChange?.change.ops.length} operations in this
            change. Snapshot at this version:
          </p>
          {/* selectedChange?.change.ops.slice(0, 50).map((op) => {
            return <pre>{JSON.stringify(op)}</pre>;
          }) */}
          {selectedChange && (
            <AtJsonRendered {...unwrapSchema(selectedChange.snapshot)} />
          )}
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
  icon?: IconName;
  portalContainer?: HTMLElement;
  tooltipContent?: string | JSX.Element | undefined;
  defaultIsOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultIsOpen);
  return (
    <>
      <Tooltip content={tooltipContent} portalContainer={portalContainer}>
        <AnchorButton
          aria-label={icon}
          icon={icon}
          minimal
          disabled={isOpen}
          onClick={(e) => {
            setIsOpen(true);
            e.stopPropagation();
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
  encodeState,
  portalContainer,
  defaultOpenInviteDialog,
  onCopy = (s) => window.navigator.clipboard.writeText(s),
}: OverlayProps<SharedPageStatusProps>) => {
  const [loading, setLoading] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(false);
  useEffect(() => {
    // todo - get is public by notebookPageId
  }, [setIsPublic]);
  return (
    <span className="samepage-shared-page-status flex flex-col mb-8 shadow-md rounded-md bg-gray-50 px-2 py-4 gap-2">
      <span className="flex gap-4 items-center text-lg">
        <Tooltip
          content={"Create Public Link"}
          portalContainer={portalContainer}
        >
          <AnchorButton
            aria-label="copy"
            disabled={loading}
            icon={
              <img
                src={"https://samepage.network/images/logo.png"}
                className={"h-8 w-8"}
                alt={"SamePage"}
              />
            }
            minimal
            onClick={() => {
              setLoading(true);
              return apiClient<{ uuid: string }>({
                method: "create-public-link",
                notebookPageId,
              })
                .then(({ uuid }) => {
                  onCopy(`${process.env.ORIGIN}/pages/${uuid}`);
                  dispatchAppEvent({
                    type: "log",
                    content: `Copied!`,
                    id: "copy-page-link",
                    intent: "success",
                  });
                  setIsPublic(true);
                })
                .catch((e) => {
                  dispatchAppEvent({
                    type: "log",
                    content: `Failed to get public link for page ${notebookPageId}: ${e.message}`,
                    id: "copy-page-failed",
                    intent: "error",
                  });
                })
                .finally(() => setLoading(false));
            }}
          />
        </Tooltip>
        <TooltipButtonOverlay
          defaultIsOpen={defaultOpenInviteDialog}
          tooltipContent={"Invite Notebook"}
          portalContainer={portalContainer}
          icon={"share"}
          Overlay={(props) => (
            <SharePageDialog {...props} notebookPageId={notebookPageId} />
          )}
        />
        <TooltipButtonOverlay
          tooltipContent={"View History"}
          portalContainer={portalContainer}
          icon={"history"}
          Overlay={(props) => (
            <Drawer
              {...props}
              title={"Page History"}
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
                    load(notebookPageId).then((doc) =>
                      Automerge.getHistory(doc)
                    )
                  }
                  portalContainer={portalContainer}
                  notebookPageId={notebookPageId}
                />
              </div>
            </Drawer>
          )}
        />
        <Tooltip
          content={"Disconnect Shared Page"}
          portalContainer={portalContainer}
        >
          <AnchorButton
            aria-label="disconnect"
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
                });
            }}
          />
        </Tooltip>
        <Tooltip content={"Manual Sync"} portalContainer={portalContainer}>
          <AnchorButton
            aria-label="manual-sync"
            disabled={loading}
            icon={"warning-sign"}
            minimal
            onClick={async () => {
              setLoading(true);
              const result = await changeState({
                notebookPageId,
                encodeState,
                label: "manual sync",
              }).catch(() => undefined);
              if (!result) {
                setLoading(false);
                return;
              }
              const { state } = result;
              apiClient({
                method: "force-push-page",
                notebookPageId,
                state,
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
      </span>
      {isPublic && (
        <span className="italic opacity-50 text-xs">
          Note - this page is publically available
        </span>
      )}
    </span>
  );
};

export default SharedPageStatus;
