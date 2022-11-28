import { gatherDocs } from "./listMarkdownFiles.server";
import { z } from "zod";

const zMetadata = z.record(
  z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    author: z.string(),
    type: z.string(),
  })
);

const listBlogPosts = () => {
  return gatherDocs(`public/blogs`).then(({ metadata: d, files: r }) => {
    const meta = zMetadata.parse(d);
    return {
      directory: r
        .filter((f) => f.name !== "metadata.json")
        .map((r) => ({ path: r.name, ...meta[r.name] })),
    };
  });
};

export default listBlogPosts;
