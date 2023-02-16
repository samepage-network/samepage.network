import fs from "fs";
import path from "path";

const readDir = (s: string): string[] =>
  fs.existsSync(s)
    ? fs
        .readdirSync(s, { withFileTypes: true })
        .flatMap((f) =>
          f.isDirectory() ? readDir(`${s}/${f.name}`) : [`${s}/${f.name}`]
        )
    : [];

const [, , id, app, workspace] = process.argv;
const files = readDir("template");
const root = `../${id}-samepage`;
fs.mkdirSync(root);
files.forEach((f) => {
  const content = fs
    .readFileSync(f)
    .toString()
    .replace(/{{id}}/g, id)
    .replace(/{{app}}/g, app)
    .replace(/{{workspace}}/g, workspace);
  const dest = f.replace(/^template/, root);
  if (!fs.existsSync(path.dirname(dest)))
    fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(f.replace(/^template/, root), content);
});
