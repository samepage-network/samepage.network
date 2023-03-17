import createAPIGatewayProxyHandler from "package/backend/createAPIGatewayProxyHandler";
import fs from "fs";
import nodeCompile from "package/scripts/internal/nodeCompile";
import dotenv from "dotenv";

const logic = async ({ id, file, ...body }: { id: string; file: string }) => {
  const root = `${process.cwd()}/../${id}-samepage`;
  const outdir = `${root}/out`;
  // use hashing to make this smarter
  //   if (!fs.existsSync(outdir)) {
  Object.keys(require.cache)
    .filter((k) => k.includes(`${id}-samepage/out`))
    .forEach((k) => {
      console.log("deleting", k);
      delete require.cache[k];
    });
  await nodeCompile({
    outdir,
    functions: [file],
    root: `${root}/src/functions`,
    define: Object.fromEntries(
      Object.entries(dotenv.parse(fs.readFileSync(`${root}/.env`))).map(
        ([k, v]) => [`process.env.${k}`, JSON.stringify(v)]
      )
    ),
  });
  //   }
  const result = await import(`${outdir}/${file}.js`).then((module) => {
    return module.handler(
      {
        body: JSON.stringify(body),
        headers: {},
        requestContext: {},
      },
      {}
    );
  });
  return JSON.parse(result.body);
};

export const handler = createAPIGatewayProxyHandler(logic);
