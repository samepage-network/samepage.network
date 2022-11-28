import algolia from "algoliasearch";
import dotenv from "dotenv";
import loadMarkdownFile from "../app/data/loadMarkdownFile.server";
import listMarkdownFiles, {
  DirectoryNode,
} from "../app/data/listMarkdownFiles.server";
dotenv.config();

// temporary until algolia crawler add-on comes online
const appId = process.env.ALGOLIA_APP_ID;
if (!appId) throw new Error(`Environment Variable ALGOLIA_APP_ID is required`);
const adminKey = process.env.ALGOLIA_ADMIN_KEY;
if (!adminKey)
  throw new Error(`Environment Variable ALGOLIA_ADMIN_KEY is required`);

const client = algolia(appId, adminKey);
const index = client.initIndex("samepage_docs");
const update = async () => {
  const { directory } = await listMarkdownFiles("docs");
  const flatten = (directory: DirectoryNode[] = []) =>
    directory.flatMap((d): { name: string; path: string }[] =>
      [{ name: d.name, path: d.path }].concat(flatten(d.children))
    );
  const records = await Promise.all(
    flatten(directory).map(async (d) => {
      const { code, frontmatter } = await loadMarkdownFile({ path: d.path });
      return { objectID: d.path, title: frontmatter.title, content: code };
    })
  ).then((records) =>
    records
      .filter((r) => !!r.content)
      .map((record) => {
        return {
          url: `https://samepage.network/docs/${record.objectID}`,
          objectID: record.objectID,
          content: record.content,
          type: "content",
          hierarchy: {
            lvl0: record.title,
            lvl1: null,
            lvl2: null,
            lvl3: null,
            lvl4: null,
            lvl5: null,
            lvl6: null,
          },
        };
      })
  );
  await index.saveObjects(records);
};
update()
  .then(() => console.log("Aloglia index updated!"))
  .catch((e) => {
    console.error("Error thrown during algolia update");
    console.error(e);
  });
