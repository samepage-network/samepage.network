import {
  Button,
  Classes,
  Drawer,
  DrawerSize,
  IconName,
  MaybeElement,
  Tooltip,
} from "@blueprintjs/core";
import { appsById } from "../internal/apps";
import React, { useState, useRef, useEffect } from "react";
import SharePageDialog, { ListConnectedNotebooks } from "./SharePageDialog";
import { OverlayProps, Schema } from "../types";
import type Automerge from "automerge";

type GetLocalHistory = (
  notebookPageId: string
) => Promise<Automerge.State<Schema>[]>;

export type Props = {
  notebookPageId: string;
  portalContainer?: HTMLElement;
  defaultOpenInviteDialog?: boolean;

  disconnectPage?: (notebookPageId: string) => Promise<void>;
  forcePushPage?: (notebookPageId: string) => Promise<void>;
  listConnectedNotebooks?: ListConnectedNotebooks;
  getLocalHistory?: GetLocalHistory;
};

const parseActorId = (s: string) =>
  s
    .split("")
    .map((c, i, a) =>
      i % 2 === 0 ? String.fromCharCode(parseInt(c + a[i + 1], 16)) : ""
    )
    .join("")
    .replace(/^\d+\//, (val) => `${appsById[val.slice(0, -1)].name}/`);

const HistoryContent = ({
  getHistory,
}: {
  getHistory: () => ReturnType<GetLocalHistory>;
}) => {
  const [history, setHistory] = useState<Awaited<ReturnType<GetLocalHistory>>>(
    []
  );
  useEffect(() => {
    getHistory().then(setHistory);
  }, [getHistory, setHistory]);
  return (
    <div className="flex flex-col-reverse text-gray-800 w-full border border-gray-800 overflow-auto justify-end">
      {history.map((l, index) => (
        <div key={index} className={"border-t border-t-gray-800 p-4 relative"}>
          <div className={"text-sm absolute top-2 right-2"}>{index}</div>
          <div>
            <span className={"font-bold"}>Action: </span>
            <span>{l.change.message}</span>
          </div>
          <div>
            <span className={"font-bold"}>Actor: </span>
            <span>{parseActorId(l.change.actor)}</span>
          </div>
          <div>
            <span className={"font-bold"}>Date: </span>
            <span>{new Date(l.change.time * 1000).toLocaleString()}</span>
          </div>
        </div>
      ))}
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
  disconnectPage = () => Promise.resolve(),
  forcePushPage = () => Promise.resolve(),
  listConnectedNotebooks = () =>
    Promise.resolve({ networks: [], notebooks: [] }),
  getLocalHistory = () => Promise.resolve([]),
}: OverlayProps<Props>) => {
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
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
            listConnectedNotebooks={listConnectedNotebooks}
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
                getHistory={() => getLocalHistory(notebookPageId)}
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
            disconnectPage(notebookPageId)
              .then(onClose)
              .catch(() => setLoading(false));
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
            forcePushPage(notebookPageId).finally(() => setLoading(false));
          }}
        />
      </Tooltip>
    </span>
  );
};

export default SharedPageStatus;
