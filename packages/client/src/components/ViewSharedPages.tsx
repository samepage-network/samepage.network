import { Button, Classes, Dialog } from "@blueprintjs/core";
import React, { useEffect, useState } from "react";
import LinkNewPage from "./LinkNewPage";
import type { OverlayProps } from "../types";
import { renderOverlay } from "../internal/registry";

type LinkProps = {
  getLocalPageTitle?: (notebookPageId: string) => Promise<string>;
  onLinkClick?: (notebookPageId: string, e: MouseEvent) => void;
  linkClassName?: string;
  linkNewPage?: (notebookPageId: string, title: string) => Promise<string>;
};

export type ViewSharedPagesProps = {
  portalContainer?: HTMLElement;
} & LinkProps;

type Props = {
  notebookPageIds: string[];
} & ViewSharedPagesProps;

const PageLink = ({
  notebookPageId,
  onClose,
  getLocalPageTitle = (uuid) => Promise.resolve(uuid),
  onLinkClick,
  linkNewPage,
  linkClassName,
}: OverlayProps<{ notebookPageId: string } & LinkProps>) => {
  const [title, setTitle] = useState<string | undefined>("");
  useEffect(() => {
    getLocalPageTitle(notebookPageId).then(setTitle);
  }, [notebookPageId]);
  return typeof title === "undefined" ? (
    <span
      className="flex"
      style={{ justifyContent: "space-between", alignItems: "center" }}
    >
      <i>Page {notebookPageId} was deleted locally. Link another page?</i>{" "}
      <Button
        icon={"link"}
        minimal
        onClick={() => {
          renderOverlay({
            Overlay: LinkNewPage,
            props: { notebookPageId, linkNewPage },
          });
          onClose();
        }}
      />
    </span>
  ) : (
    <a
      data-link-title={title}
      className={
        linkClassName
          ? `samepage-shared-page-link ${linkClassName}`
          : "samepage-shared-page-link"
      }
      onMouseDown={(e) => {
        onLinkClick?.(notebookPageId, e.nativeEvent);
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {title}
    </a>
  );
};

const ViewSharedPages = ({
  onClose,
  isOpen,
  notebookPageIds,
  portalContainer,
  ...linkProps
}: OverlayProps<Props>) => {
  return (
    <Dialog
      onClose={onClose}
      isOpen={isOpen}
      title={"Shared Pages"}
      autoFocus={false}
      enforceFocus={false}
      portalContainer={portalContainer}
    >
      <div className={Classes.DIALOG_BODY}>
        {notebookPageIds.length ? (
          <ul>
            {notebookPageIds.map((notebookPageId) => (
              <li key={notebookPageId}>
                <PageLink
                  notebookPageId={notebookPageId}
                  onClose={onClose}
                  {...linkProps}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div>No pages shared yet.</div>
        )}
      </div>
    </Dialog>
  );
};

export default ViewSharedPages;
