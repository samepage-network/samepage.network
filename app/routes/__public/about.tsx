import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import About from "@dvargas92495/app/components/About";

const AboutPage: React.FunctionComponent = () => (
  <About
    title={"SamePage"}
    subtitle={"Connect your PKM tool to the PKM tools of your colleagues"}
    paragraphs={[
      "Alice uses Roam. Bob uses Obsidian. Eve prefers LogSeq. How would they all collaborate on a project or research question?",
      "In the past, two out of the three would have to compromise on their PKM tool to work in another ecosystem. Or they would work in some fourth tool, copying and pasting notes across tools, reformatting after each paste. The process becomes tedious, very prone to error, and often leading to an end of collaboration.",
      "Enter SamePage. With the SamePage network, all users could stay in the PKM tool of their choice. Through the use of extensions, they could connect to each other so that all changes sync across apps. No more compromising. No more error-prone copy+paste.",
    ]}
  />
);

export const meta = getMeta({ title: "About" });

export default AboutPage;
