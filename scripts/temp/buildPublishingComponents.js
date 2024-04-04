const esbuild = require("esbuild");
const fs = require("fs");
const { S3 } = require("@aws-sdk/client-s3");

const extensions = fs.readdirSync("./app/components/publishing");
const entryPoints = Object.fromEntries(
  extensions.map((e) => [
    e
      .substring(0, e.length - 4)
      .split(/(?=[A-Z])/)
      .map((s) => s.toLowerCase())
      .join("-"),
    `./components/${e}`,
  ])
);

esbuild
  .build({
    entryPoints,
    minify: true,
    bundle: true,
    outdir: "build/publishing",
    define: {
      "process.env.CLIENT_SIDE": "true",
      "process.env.BLUEPRINT_NAMESPACE": '"bp3"',
    },
  })
  .then((e) => console.log("Components built!", e))
  .then(() => {
    const s3 = new S3({});
    return Promise.all(
      fs.readdirSync("build/publishing").map((file) => {
        return s3
          .putObject({
            Bucket: "samepage.network",
            Key: `public/scripts/${file}`,
            Body: fs.createReadStream(`build/publishing/${file}`),
            ContentType: "application/javascript",
          })
          .then(() => console.log(`Uploaded ${file}`));
      })
    );
  })
  .then((e) => console.log("Components updated!", e));
