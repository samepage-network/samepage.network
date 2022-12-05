import queryRoam from "./queryRoam.server";
import { z } from "zod";
import { InitialSchema } from "package/internal/types";

type Block = {
  ":block/uid": string;
  ":block/string": string;
  ":block/order": number;
  ":block/children"?: Block[];
};

const zBlock: z.ZodType<Block> = z.lazy(() =>
  z.object({
    ":block/uid": z.string(),
    ":block/string": z.string(),
    ":block/order": z.number(),
    ":block/children": z.array(zBlock).optional(),
  })
);
const zResponse = z.object({
  result: z.tuple([zBlock, z.object({ ":node/title": z.string() })]).array(),
});
const toAtJson = ({
  nodes = [],
  level = 1,
  startIndex = 0,
}: {
  nodes?: Block[];
  level?: number;
  startIndex?: number;
}): InitialSchema =>
  nodes
    .sort((a, b) => a[":block/order"] - b[":block/order"])
    .map((n) => (index: number) => {
      const content = `${n[":block/string"]}\n`;
      const end = content.length + index;
      const blockAnnotation: InitialSchema["annotations"] = [
        {
          start: index,
          end,
          attributes: {
            level: level,
            viewType: "bullet",
          },
          type: "block",
        },
      ];
      const { content: childrenContent, annotations: childrenAnnotations } =
        toAtJson({
          nodes: n[":block/children"],
          level: level + 1,
          startIndex: end,
        });
      return {
        content: `${content}${childrenContent}`,
        annotations: blockAnnotation.concat(childrenAnnotations),
      };
    })
    .reduce(
      ({ content: pc, annotations: pa }, c) => {
        const { content: cc, annotations: ca } = c(startIndex + pc.length);
        return {
          content: `${pc}${cc}`,
          annotations: pa.concat(ca),
        };
      },
      {
        content: "",
        annotations: [] as InitialSchema["annotations"],
      }
    );

const getRoadmapTask = ({
  params,
}: {
  params: Record<string, string | undefined>;
}) => {
  return queryRoam(
    `[:find 
        (pull ?b [:block/uid :block/string :block/order {:block/children ...}])
        (pull ?p [:node/title])
      :where
        [?p :block/uid "${params["uid"]}"]
        [?s :node/title "SamePage"]
        [?d :node/title "Description"]
        [?IssueType-Attribute :node/title "IssueType"]
        [?p :block/children ?m]
        [?m :block/refs ?s]
        [?p :block/children ?b]
        [?b :block/refs ?d]
        [?IssueType :block/refs ?IssueType-Attribute]
        [?IssueType :block/parents ?p]
        [?IssueType :block/refs ?type]
        (not [?type :node/title "Blog Post"])
        (not [?type :node/title "IssueType"])
    ]`
  ).then((r) => {
    const { result } = zResponse.parse(JSON.parse(r.body));
    if (!result.length)
      return {
        title: "Not Found",
        description: {
          content: "",
          annotations: [],
        },
      };
    const [[root, page]] = result;
    return {
      description: toAtJson({ nodes: root[":block/children"] }),
      title: page[":node/title"].replace(/^\[\[ISS\]\] - /, ""),
    };
  });
};

export default getRoadmapTask;
