import { Button, Classes, Dialog } from "@blueprintjs/core";
import React from "react";
import LinkNewPage from "./LinkNewPage";
import type { OverlayProps, SamePageSchema } from "../internal/types";
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
  pages: { linkUuid: string; title: SamePageSchema; notebookPageId: string }[];
} & ViewSharedPagesProps;

const PageLink = ({
  notebookPageId,
  onClose,
  getLocalPageTitle = (uuid) => Promise.resolve(uuid),
  onLinkClick,
  linkNewPage,
  linkClassName,
}: OverlayProps<{ notebookPageId: string } & LinkProps>) => {
  const [title, setTitle] = React.useState<string | undefined>("");
  React.useEffect(() => {
    getLocalPageTitle(notebookPageId).then(setTitle);
  }, [notebookPageId]);
  return typeof title === "undefined" ? (
    <span className="flex justify-between items-center">
      <i>
        Page {notebookPageId} is missing from your notebook. Link another page?
      </i>{" "}
      <Button
        icon={"link"}
        minimal
        onClick={() => {
          renderOverlay({
            id: "samepage-link-new-page",
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
        onClose();
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
  pages,
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
        {pages.length ? (
          <ul>
            {pages.map((page) => (
              <li key={page.notebookPageId}>
                <PageLink
                  notebookPageId={page.notebookPageId}
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
