const createHTMLObserver = <T extends HTMLElement>({
  callback,
  selector,
}: {
  callback: (el: T) => void;
  selector: string;
}) => {
  const getChildren = (d: Node) =>
    d.nodeType === d.ELEMENT_NODE
      ? Array.from((d as HTMLElement).querySelectorAll<T>(selector))
      : [];
  const isNode = (d: Node): d is T =>
    d.nodeType === d.ELEMENT_NODE && (d as Element).matches(selector);
  const getNodes = (nodes: NodeList) =>
    Array.from(nodes)
      .filter((d: Node) => isNode(d) || d.hasChildNodes())
      .flatMap((d) => (isNode(d) ? [d] : getChildren(d)));

  getChildren(window.parent.document.body).forEach(callback);
  const observer = new MutationObserver((records) => {
    records.flatMap((m) => getNodes(m.addedNodes)).forEach(callback);
  });
  observer.observe(window.parent.document.body, {
    childList: true,
    subtree: true,
  });
  return observer;
};

export default createHTMLObserver;
