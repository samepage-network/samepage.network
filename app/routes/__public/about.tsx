import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import About from "@dvargas92495/app/components/About";

const AboutPage: React.FunctionComponent = () => (
  <About title={"Samepage"} subtitle={"Description"} paragraphs={[]} />
);

export const meta = getMeta({ title: "About" });

export default AboutPage;
