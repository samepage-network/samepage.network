import type { JSDOM } from "jsdom";
import type { marked } from "marked";

export type PublishingContext = {
  pagesToHrefs?: (page: string, uid?: string) => string;
  components?: (c: string, ac?: string) => string | false;
  blockReferences?: (
    ref: string | undefined
  ) => { text: string | undefined; page: string } | undefined;
  marked: {
    parseInline: (s: string) => string;
    lastSrc: string;
    used: boolean;
    lexInline: typeof marked.Lexer.lexInline;
  };
};

export type ViewType = "document" | "bullet" | "numbered";

export type TextAlignment = "left" | "center" | "right" | "justify";

export type TreeNode = {
  text: string;
  order: number;
  children: TreeNode[];
  parents: number[];
  uid: string;
  heading: number;
  open: boolean;
  viewType: ViewType;
  editTime: Date;
  textAlign: TextAlignment;
  props: {
    imageResize: {
      [link: string]: {
        height: number;
        width: number;
      };
    };
    iframe: {
      [link: string]: {
        height: number;
        width: number;
      };
    };
  };
};

export type PartialRecursive<T> = T extends object
  ? { [K in keyof T]?: PartialRecursive<T[K]> }
  : T;

export type RenderFunction = (
  dom: JSDOM,
  props: Record<string, string[]>,
  context: {
    convertPageNameToPath: (s: string) => string;
    references: { title: string; node: PartialRecursive<TreeNode> }[];
    pageName: string;
    deployId: string;
    parseInline: (
      str: string,
      ctx?: Omit<PublishingContext, "marked">
    ) => string;
  }
) => void;

declare global {
  interface Window {
    roamjsProps: Record<string, unknown>;
  }
}
