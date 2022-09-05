import fs from "fs";
import nearley from "nearley";
// @ts-ignore all imports in this file are valid - not sure how to type manually
import nearleyc from "nearley/lib/compile";
// @ts-ignore all imports in this file are valid - not sure how to type manually
import nearleys from "nearley/lib/stream";
// @ts-ignore all imports in this file are valid - not sure how to type manually
import nearleylang from "nearley/lib/nearley-language-bootstrapped";
// @ts-ignore all imports in this file are valid - not sure how to type manually
import nearleyg from "nearley/lib/generate";
// @ts-ignore all imports in this file are valid - not sure how to type manually
import nearleyl from "nearley/lib/lint";

const nearleyCompile = (f: string) => {
  const parserGrammar = nearley.Grammar.fromCompiled(nearleylang);
  const parser = new nearley.Parser(parserGrammar);
  const base = f.replace(/\.ne$/, "");
  const input = fs.createReadStream(`${base}.ne`);
  const output = fs.createWriteStream(`${base}.ts`);
  return new Promise<void>((resolve, reject) =>
    input
      .pipe(new nearleys(parser))
      .on("finish", function () {
        try {
          parser.feed("\n");
          const c = nearleyc(parser.results[0], {});
          nearleyl(c, { out: process.stderr });
          output.write(nearleyg(c));

          resolve();
        } catch (e) {
          reject(e);
        }
      })
      .on("error", (e: Error) => {
        console.error("Error compiling nearley file", base);
        console.error(e);
      })
  ).catch((e) => {
    console.error("Error running nearley compiler on file", base);
    console.error(e);
  });
};

export default nearleyCompile;
