import { z } from "zod";
import queryRoam from "./queryRoam.server";

const zResponse = z.object({
  result: z
    .tuple([
      z.object({ ":block/uid": z.string(), ":node/title": z.string() }),
      z.object({ ":block/string": z.string() }),
    ])
    .array(),
});

// TODO - in the future, performs a cross notebook query and acts as a SamePage Client
// OR   - uses SamePage Publish
const getRoadmap = () => {
  return queryRoam(`[:find
        (pull ?block [:node/title :block/uid])
        (pull ?Priority [:block/string])
    :where
      [?SamePage :node/title "SamePage"]
      [?Status-Attribute :node/title "Status"]
      [?Priority-Attribute :node/title "Priority"]
      [?IssueType-Attribute :node/title "IssueType"]
      [?open :node/title "open"]
      [?Project :node/title "Project"]
      [?project :block/refs ?SamePage]
      [?block :block/children ?project]
      [?Status :block/refs ?Status-Attribute]
      [?Priority :block/refs ?Priority-Attribute]
      [?IssueType :block/refs ?IssueType-Attribute]
      [?Status :block/parents ?block]
      [?Priority :block/parents ?block]
      [?IssueType :block/parents ?block]
      [?IssueType :block/refs ?type]
      [?Status :block/refs ?open]
      [?project :block/refs ?Project]
      (not [?block :block/parents ?_])
      (not [?type :node/title "Blog Post"])
      (not [?type :node/title "IssueType"])
    ]`).then((r) => {
    const { result } = zResponse.parse(JSON.parse(r.body));
    return {
      columns: [{ Header: "Title", accessor: "title" }],
      data: result
        .map((r) => ({
          title: r[0][":node/title"].replace(/^\[\[ISS\]\] - /, ""),
          id: r[0][":block/uid"],
          priority: Number(
            r[1][":block/string"].replace(/^Priority::/, "").trim()
          ),
        }))
        .sort((a, b) => a.priority - b.priority),
    };
  });
};

export default getRoadmap;
