const ensureBlueprint = (document: Document, head = document.head): void => {
  if (!document.getElementById("roamjs-blueprint")) {
    const bp = document.createElement("link");
    bp.id = "roamjs-blueprint";
    bp.href =
      "https://unpkg.com/@blueprintjs/core@^3.10.0/lib/css/blueprint.css";
    const normalize = document.createElement("link");
    normalize.id = "roamjs-blueprint-normalize";
    normalize.href = "https://unpkg.com/normalize.css@^7.0.0";
    bp.rel = normalize.rel = "stylesheet";
    head.appendChild(normalize);
    head.appendChild(bp);
  }
};

export default ensureBlueprint;
