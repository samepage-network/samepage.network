import fs from "fs";
import nodepath from "path";
import axios from "axios";
import grayMatter from "gray-matter";

const bundleMDX = async ({ source }: { source: string }) => {
  const { data, content } = grayMatter(source);
  return { frontmatter: data, code: content };
};

const rawGithubClient = async ({
  repo,
  file,
}: {
  repo: string;
  file: string;
}) => {
  if (process.env.NODE_ENV === "development") {
    const fileName =
      repo === "samepage.network" ? file : nodepath.join("..", repo, file);
    if (!fs.existsSync(fileName)) return "";
    return fs.readFileSync(fileName).toString();
  }
  return axios
    .get(
      `https://raw.githubusercontent.com/samepage-network/${repo}/main/${file}`,
      { responseType: "document" }
    )
    .then((r) => r.data as string)
    .catch(() => "");
};

const loadMarkdownFile = async ({
  path,
  repo = "samepage.network",
}: {
  path: string;
  repo?: string;
}) => {
  const fileName = path || "index";
  const source = await rawGithubClient({
    repo,
    file: `${fileName}.md`,
  });
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
