import fs from "fs";
import axios from "axios";
import nodepath from "path";
import { z } from "zod";

export type DirectoryNode = {
  name: string;
  path: string;
  children?: DirectoryNode[];
};

const zMetadata = z.object({
  order: z.string().array().default([]),
  names: z.record(z.string()).default({}),
});

export const gatherDocs = (path: string) => {
  const metadataPath = nodepath.join(path, "metadata.json");
  return (
    process.env.NODE_ENV === "production"
      ? Promise.all([
          axios
            .get<[{ name: string; type: "file" | "dir"; path: string }]>(
              `https://api.github.com/repos/vargasarts/samepage.network/contents/${path}`
            )
            .then((r) => r.data)
            .catch(() => []),
          axios
            .get(
              `https://raw.githubusercontent.com/vargasarts/samepage.network/main/${metadataPath}`,
              { responseType: "json" }
            )
            .then((r) => r.data)
            .catch(() => ({})),
        ])
      : Promise.all([
          fs.existsSync(path)
            ? fs.readdirSync(path, { withFileTypes: true }).map((f) => ({
                path: nodepath.join(path, f.name),
                name: f.name,
                type: f.isDirectory() ? "dir" : "file",
              }))
            : [],
          fs.existsSync(metadataPath)
            ? JSON.parse(fs.readFileSync(metadataPath).toString())
            : {},
        ])
  ).then(([files, metadata]) => ({ files, metadata }));
};

const listMarkdownFiles = async (
  root: string,
  customLoaders?: {
    [key: string]: () => Promise<{ directory: DirectoryNode[] }>;
  }
): Promise<{ directory: DirectoryNode[] }> => {
  if (customLoaders && root in customLoaders) return customLoaders[root]();
  return gatherDocs(root)
    .then(({ metadata: d, files: r }) => {
      const parsedMeta = zMetadata.safeParse(d);
      const meta = parsedMeta.success ? parsedMeta.data : zMetadata.parse({});
      const orderByPath = Object.fromEntries(meta.order.map((m, i) => [m, i]));
      return Promise.all(
        r
          .filter((f) => f.name !== "metadata.json")
          .map((f) => {
            const name =
              meta.names[f.name] ||
              f.name.replace(/\.[a-z]+$/, "").replace(/_/g, " ");
            const order =
              f.name in orderByPath ? orderByPath[f.name] : Number.MAX_VALUE;
            const path = f.path
              .replace(/\.[a-z]+$/, "")
              .replace(/^docs\//, "")
              .replace(/^docs\\/, ""); // for Windows OS
            return f.type === "dir"
              ? listMarkdownFiles(f.path, customLoaders).then(
                  ({ directory: children }) => ({
                    name,
                    path,
                    children,
                    order,
                  })
                )
              : {
                  name,
                  path,
                  order,
                };
          })
      ).then((results) =>
        results.sort(
          (a, b) => a.order - b.order || a.name.localeCompare(b.name)
        )
      );
    })
    .then((directory) => ({
      directory,
    }));
};

export type ListMarkdownFiles = Awaited<ReturnType<typeof listMarkdownFiles>>;

export default listMarkdownFiles;
