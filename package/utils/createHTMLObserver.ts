import { appRoot } from "../internal/registry";

const createHTMLObserver = <T extends ChildNode>({
  callback,
  onRemove,
  onClassName,
  selector: _selector,
}: {
  onClassName?: (el: T) => void;
  onRemove?: (el: T) => void;
  callback: (el: T) => void;
  selector: string;
}) => {
  if (!appRoot)
    throw new Error(
      `Could not find application root. createHTMLObserver is not supported in \`node\` environments.`
    );
  const isTextNodeSelector = _selector.endsWith("#text");
  const selector = _selector.replace(/#text$/, "");
  const getChildren = (d: Node): T[] => {
    return d.nodeType === d.ELEMENT_NODE
      ? (Array.from((d as HTMLElement).querySelectorAll(selector)).flatMap(
          (c) => {
            return isTextNodeSelector
              ? Array.from(c.childNodes).filter(
                  (cn) => cn.nodeType === cn.TEXT_NODE
                )
              : [c];
          }
        ) as T[])
      : [];
  };
  const isNode = (d: Node, target: Node): d is T => {
    if (d.nodeType === d.ELEMENT_NODE) return (d as Element).matches(selector);
    if (d.nodeType === d.TEXT_NODE) {
      const parent = d.parentElement;
      if (parent) return parent.matches(selector);
      if (target.nodeType === target.ELEMENT_NODE)
        return (target as Element).matches(selector);
      return false;
    }
    return false;
  };
  const getNodes = (nodes: NodeList, target: Node) =>
    Array.from(nodes)
      .filter((d: Node) => isNode(d, target) || d.hasChildNodes())
      .flatMap((d) => (isNode(d, target) ? [d] : getChildren(d)));

  getChildren(appRoot).forEach(callback);
  const observer = new MutationObserver((records) => {
    records.forEach((r) => {
      if (r.type === "childList") {
        getNodes(r.addedNodes, r.target).forEach(callback);
        if (onRemove) getNodes(r.removedNodes, r.target).forEach(onRemove);
      } else if (r.type === "attributes") {
        const className = (selector.match(/\.[^.]$/)?.[0] || "").slice(1);
        if (r.oldValue && r.oldValue.includes(className))
          onRemove?.(r.target as T);
        if (isNode(r.target, r.target)) callback(r.target);
      }
    });
  });
  observer.observe(
    appRoot,
    onClassName
      ? {
          childList: true,
          subtree: true,
          attributeFilter: ["class"],
          attributeOldValue: true,
        }
      : {
          childList: true,
          subtree: true,
        }
  );
  return observer;
};

export default createHTMLObserver;
