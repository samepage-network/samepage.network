import { Button, Popover, Spinner, Tooltip } from "@blueprintjs/core";
import React, { useState, useRef, useEffect } from "react";
import type setupSharePageWithNotebook from "../protocols/sharePageWithNotebook";
import SharePageDialog from "./SharePageDialog";

type SharePageReturn = ReturnType<typeof setupSharePageWithNotebook>;

export type Props = {
  notebookPageId: string;
  portalContainer?: HTMLElement;
} & Pick<
  SharePageReturn,
  "disconnectPage" | "sharePage" | "forcePushPage" | "listConnectedNotebooks"
>;

const formatVersion = (s: number) =>
  s ? new Date(s * 1000).toLocaleString() : "unknown";

const ConnectedNotebooks = ({
  notebookPageId,
  listConnectedNotebooks,
}: {
  notebookPageId: string;
  listConnectedNotebooks: Props["listConnectedNotebooks"];
}) => {
  const [loading, setLoading] = useState(true);
  const [notebooks, setNotebooks] = useState<
    Awaited<ReturnType<Props["listConnectedNotebooks"]>>["notebooks"]
  >([]);
  const [networks, setNetworks] = useState<
    Awaited<ReturnType<Props["listConnectedNotebooks"]>>["networks"]
  >([]);
  useEffect(() => {
    listConnectedNotebooks(notebookPageId)
      .then((r) => {
        setNotebooks(r.notebooks);
        setNetworks(r.networks);
      })
      .finally(() => setLoading(false));
  }, [setLoading]);
  return (
    <div className="flex p-4 rounded-md flex-col">
      {loading ? (
        <Spinner />
      ) : (
        <>
          <h3>Notebooks:</h3>
          <ul>
            {notebooks.map((c) => (
              <li key={`${c.app}-${c.workspace}`}>
                <div className="flex items-center justify-between">
                  <span>
                    {c.app}/{c.workspace}
                  </span>
                  <span className="opacity-75 text-gray-600 text-sm">
                    {formatVersion(c.version)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <h3>Networks:</h3>
          <ul>
            {networks.map((c) => (
              <li key={`${c.app}-${c.workspace}`}>
                <div className="flex items-center justify-between">
                  <span>
                    {c.app}/{c.workspace}
                  </span>
                  <span className="opacity-75 text-gray-600 text-sm">
                    {formatVersion(c.version)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const InviteNotebook = ({
  portalContainer,
  notebookPageId,
  sharePage,
}: {
  notebookPageId: string;
  sharePage: SharePageReturn["sharePage"];
  portalContainer?: HTMLElement;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Tooltip content={"Invite Notebook"} portalContainer={portalContainer}>
        <Button
          icon={"plus"}
          minimal
          disabled={isOpen}
          onClick={() => {
            setIsOpen(true);
          }}
        />
      </Tooltip>
      <SharePageDialog
        onSubmit={({ notebooks }) => sharePage({ notebooks, notebookPageId })}
        onClose={() => setIsOpen(false)}
        isOpen={isOpen}
        portalContainer={portalContainer}
      />
    </>
  );
};

const SharedPageStatus = ({
  notebookPageId,
  portalContainer,
  sharePage,
  disconnectPage,
  forcePushPage,
  listConnectedNotebooks,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  return (
    <span
      className="samepage-shared-page-status flex gap-4 items-center text-lg mb-8"
      ref={containerRef}
    >
      <i>Shared</i>
      <Tooltip
        content={"Notebooks Connected"}
        portalContainer={portalContainer}
      >
        <Popover
          content={
            <ConnectedNotebooks
              notebookPageId={notebookPageId}
              listConnectedNotebooks={listConnectedNotebooks}
            />
          }
          target={<Button icon={"info-sign"} minimal disabled={loading} />}
          portalContainer={portalContainer}
        />
      </Tooltip>
      <InviteNotebook
        notebookPageId={notebookPageId}
        sharePage={sharePage}
        portalContainer={portalContainer}
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
            disconnectPage(notebookPageId).finally(() => setLoading(false));
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
