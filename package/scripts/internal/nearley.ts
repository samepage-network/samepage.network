import fs from "fs";
import nearley from "nearley";
import nearleyc from "nearley/lib/compile";
import nearleys from "nearley/lib/stream";
import nearleylang from "nearley/lib/nearley-language-bootstrapped";
import nearleyg from "nearley/lib/generate";
import nearleyl from "nearley/lib/lint";

const nearleyCompile = (f: string) => {
  const parserGrammar = nearley.Grammar.fromCompiled(nearleylang);
  const parser = new nearley.Parser(parserGrammar);
  const base = f.replace(/\.ne$/, "");
  const input = fs.createReadStream(`${base}.ne`);
  return new Promise<string>((resolve, reject) =>
    input
      .pipe(new nearleys(parser))
      .on("finish", function () {
        try {
          parser.feed("\n");
          const c = nearleyc(parser.results[0], {});
          nearleyl(c, { out: process.stderr });
          const content = nearleyg(c);
          resolve(content);
        } catch (e) {
          reject(e);
        }
      })
      .on("error", (e: Error) => {
        console.error("Error compiling nearley file", base);
        console.error(e);
        reject(e);
      })
  ).catch((e) => {
    console.error("Error running nearley compiler on file", base);
    console.error(e);
    return Promise.reject(e);
  });
};

export default nearleyCompile;
