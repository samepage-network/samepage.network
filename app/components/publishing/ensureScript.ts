const ensureScript = (
  id: string,
  componentProps: Record<string, unknown>,
  document: Document,
  head = document.head
): void => {
  const propScript = document.createElement("script");
  propScript.innerHTML = `window.roamjsProps = {
            ...window.roamjsProps,
            "${id}": ${JSON.stringify(componentProps)}
          }`;
  propScript.type = "text/javascript";
  head.appendChild(propScript);
  const componentScript = document.createElement("script");
  componentScript.src = `${process.env.COMPONENTS_URL}/${id}.js`;
  componentScript.defer = true;
  head.appendChild(componentScript);
};

export default ensureScript;
