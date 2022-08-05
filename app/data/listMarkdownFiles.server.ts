import fs from "fs";
import axios from "axios";

const listMarkdownFiles = () => {
  return (
    process.env.NODE_ENV === "development"
      ? Promise.resolve(fs.readdirSync("docs"))
      : axios
          .get<[{ name: string }]>(
            "https://api.github.com/repos/dvargas92495/samepage.network/contents/docs"
          )
          .then((r) => r.data.map((f) => f.name))
  ).then((files) => ({
    directory: [
      {
        path: "",
        name: "Home",
      },
    ].concat(
      files.map((f) => ({
        path: f.replace(/\.md$/, ""),
        name: f
          .replace(/\.md$/, "")
          .split(/-/)
          .map(
            (p) => `${p.slice(0, 1).toUpperCase()}${p.slice(1).toLowerCase()}`
          )
          .join(" "),
      }))
    ),
  }));
};

export default listMarkdownFiles;
