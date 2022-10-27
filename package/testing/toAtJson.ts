import { InitialSchema } from "package/internal/types";
import { reduceTokens } from "package/utils/atJsonTokens";

const toAtJson = (node: ChildNode): InitialSchema => {
  if (node.nodeType === node.TEXT_NODE) {
    return {
      content: node.nodeValue || "",
      annotations: [],
    };
  } else if (node.nodeType === node.ELEMENT_NODE) {
    const el = node as Element;
    const schemas = Array.from(el.childNodes).map((c) => toAtJson(c));
    const childSchema = reduceTokens([schemas]) as InitialSchema;
    if (el.tagName === "DIV") {
      return {
        content: `${childSchema.content}\n`,
        annotations: [
          {
            start: 0,
            end: childSchema.content.length + 1,
            type: "block",
            attributes: {
              viewType: "document",
              level: 1,
            },
          },
        ],
      };
    } else if (el.tagName === "LI") {
      return {
        content: `${childSchema.content}\n`,
        annotations: [
          {
            start: 0,
            end: childSchema.content.length + 1,
            type: "block",
            attributes: {
              viewType: "bullet",
              level: 1,
            },
          },
        ],
      };
    } else if (el.tagName === "SPAN") {
      const span = el as HTMLSpanElement;
      if (el.classList.contains("samepage-reference")) {
        const [notebookUuid, notebookPageId] = span.title.split(":");
        return {
          content: childSchema.content,
          annotations: [
            {
              start: 0,
              end: childSchema.content.length,
              type: "reference",
              attributes: {
                notebookPageId,
                notebookUuid,
              },
            },
          ],
        };
      } else if (el.classList.contains("samepage-highlighting")) {
        return {
          content: childSchema.content,
          annotations: [
            {
              start: 0,
              end: childSchema.content.length,
              type: "highlighting",
            },
          ],
        };
      } else {
        console.warn(`UNKNOWN SPAN CLASS`, span.className);
        return {
          content: span.innerText || "",
          annotations: [],
        };
      }
    } else if (el.tagName === "B") {
      return {
        content: childSchema.content,
        annotations: [
          {
            start: 0,
            end: childSchema.content.length,
            type: "bold",
          },
        ],
      };
    } else if (el.tagName === "I") {
      return {
        content: childSchema.content,
        annotations: [
          {
            start: 0,
            end: childSchema.content.length,
            type: "italics",
          },
        ],
      };
    } else if (el.tagName === "IMG") {
      const img = el as HTMLImageElement;
      return {
        content: childSchema.content,
        annotations: [
          {
            start: 0,
            end: childSchema.content.length,
            type: "image",
            attributes: {
              src: img.src,
            },
          },
        ],
      };
    } else if (el.tagName === "A") {
      const a = el as HTMLAnchorElement;
      return {
        content: childSchema.content,
        annotations: [
          {
            start: 0,
            end: childSchema.content.length,
            type: "link",
            attributes: {
              href: a.href,
            },
          },
        ],
      };
    } else if (el.tagName === "BODY") {
      return childSchema;
    } else {
      console.warn(`UNKNOWN TAG NAME`, el.tagName);
      return {
        content: el.innerHTML || "",
        annotations: [],
      };
    }
  } else {
    console.warn(`UNKNOWN NODE TYPE`, node.nodeType);
    return {
      content: node.nodeValue || "",
      annotations: [],
    };
  }
};

export default toAtJson;
