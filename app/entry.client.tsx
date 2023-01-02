import { hydrateRoot } from "react-dom/client";
import { RemixBrowser } from "@remix-run/react";

const dsToRemove = Array.from(document.body.children)
  .filter(
    (d): d is HTMLDivElement =>
      d.nodeName === "DIV" &&
      d.getAttribute("style") === "position: static !important;"
  )
  .map((d) => ({ d, before: d.nextSibling }));
dsToRemove.forEach(({ d }) => d.remove());

hydrateRoot(document, <RemixBrowser />);
