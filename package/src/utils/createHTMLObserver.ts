import { appRoot } from "../internal/registry";

const createHTMLObserver = <T extends ChildNode>({
  callback,
  onRemove,
  selector: _selector,
}: {
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
  const isNode = (d: Node): d is T =>
    d.nodeType === d.ELEMENT_NODE
      ? (d as Element).matches(selector)
      : d.nodeType === d.TEXT_NODE &&
        !!d.parentElement &&
        d.parentElement.matches(selector);
  const getNodes = (nodes: NodeList) =>
    Array.from(nodes)
      .filter((d: Node) => isNode(d) || d.hasChildNodes())
      .flatMap((d) => (isNode(d) ? [d] : getChildren(d)));

  getChildren(appRoot).forEach(callback);
  const observer = new MutationObserver((records) => {
    records.flatMap((m) => getNodes(m.addedNodes)).forEach(callback);
    if (onRemove)
      records.flatMap((m) => getNodes(m.removedNodes)).forEach(onRemove);
  });
  observer.observe(appRoot, {
    childList: true,
    subtree: true,
  });
  return observer;
};

export default createHTMLObserver;
