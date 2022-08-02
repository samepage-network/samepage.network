import fs from "fs";
import axios from "axios";
import { bundleMDX } from "mdx-bundler";

const loadMarkdownFile = async ({ path }: { path: string }) => {
  const fileName = path || "index";
  const source =
    process.env.NODE_ENV === "development"
      ? fs.existsSync(`./docs/${fileName}.md`)
        ? fs.readFileSync(`./docs/${fileName}.md`).toString()
        : undefined
      : await axios
          .get(
            `https://raw.githubusercontent.com/dvargas92495/samepage.network/main/docs/${fileName}.md`,
            { responseType: "document" }
          )
          .then((r) => r.data as string)
          .catch(undefined);
  return source
    ? bundleMDX({ source })
    : {
        code: "",
        frontmatter: {
          title: "Page Not Found!",
          description: "Return to home",
        },
      };
};

export default loadMarkdownFile;
