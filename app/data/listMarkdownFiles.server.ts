import fs from "fs";
import axios from "axios";

export type DirectoryNode = { name: string; path: string; children?: DirectoryNode[] };

const gatherDocs = (path: string): Promise<DirectoryNode[]> =>
  axios
    .get<[{ name: string; type: "file" | "dir"; path: string }]>(
      `https://api.github.com/repos/vargasarts/samepage.network/contents/${path}`
    )
    .then((r) =>
      Promise.all(
        r.data.map((f) =>
          f.type === "dir"
            ? gatherDocs(f.path).then((children) => ({
                name: f.name,
                path: `/${f.path}`,
                children,
              }))
            : { name: f.name.replace(/\.md$/, ""), path: `/${f.path.replace(/\.md$/, "")}` }
        )
      )
    );

const listMarkdownFiles = () => {
  return (
    process.env.NODE_ENV === "test"
      ? Promise.resolve(
          fs
            .readdirSync("docs")
            .map((f) => ({ path: `/docs/${f.replace(/\.md$/, "")}`, name: f.replace(/\.md$/, "") }))
        )
      : gatherDocs("docs")
  ).then((files) => ({
    directory: [
      {
        path: "/docs",
        name: "Home",
      },
    ].concat(files),
  }));
};

export default listMarkdownFiles;
