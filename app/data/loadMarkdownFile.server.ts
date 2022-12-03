import fs from "fs";
import axios from "axios";
import grayMatter from "gray-matter";

const bundleMDX = async ({ source }: { source: string }) => {
  const { data, content } = grayMatter(source);
  return { frontmatter: data, code: content };
};

const loadMarkdownFile = async ({ path }: { path: string }) => {
  const fileName = path || "index";
  const source =
    process.env.NODE_ENV === "development"
      ? fs.existsSync(`./${fileName}.md`)
        ? fs.readFileSync(`./${fileName}.md`).toString()
        : undefined
      : await axios
          .get(
            `https://raw.githubusercontent.com/vargasarts/samepage.network/main/${fileName}.md`,
            { responseType: "document" }
          )
          .then((r) => r.data as string)
          .catch(() => "");
  return source
    ? {
        ...(await bundleMDX({ source }).catch((e) => ({
          code: "",
          frontmatter: {
            title: "Failed to compile Markdown file",
            description: `Error: ${e.message}`,
          },
        }))),
        success: true,
      }
    : {
        code: "",
        frontmatter: {
          title: "Page Not Found!",
          description: "Return to home",
        },
        success: false,
      };
};

export default loadMarkdownFile;
