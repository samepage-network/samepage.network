import React from "react";
import getMeta from "@dvargas92495/app/utils/getMeta";
import Contact from "@dvargas92495/app/components/Contact";

const ContactPage: React.FunctionComponent = () => (
  <Contact email={"support@samepage.network"} />
);

export const meta = getMeta({ title: "Contact Us" });

export default ContactPage;
