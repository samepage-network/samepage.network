import { InitialSchema } from "package/internal/types";

const firstBlockDoc = (doc: InitialSchema): InitialSchema => {
  const firstBlock = doc.annotations.find((a) => a.type === "block");
  if (!firstBlock) return doc;
  return {
    content: doc.content.slice(0, firstBlock.end),
    annotations: doc.annotations.filter((a) => a.end < firstBlock.end),
  };
};

export default firstBlockDoc;
