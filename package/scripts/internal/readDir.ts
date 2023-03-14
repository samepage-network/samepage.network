import fs from "fs";

const readDir = (s: string): string[] =>
  fs.existsSync(s)
    ? fs
        .readdirSync(s, { withFileTypes: true })
        .flatMap((f) =>
          f.isDirectory() ? readDir(`${s}/${f.name}`) : [`${s}/${f.name}`]
        )
    : [];

export default readDir;
