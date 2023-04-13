import type { V2_MetaFunction } from "@remix-run/node";

const getMeta =
  ({
    title,
    description = "",
    img = "",
  }: {
    title: string;
    description?: string;
    img?: string;
  }): V2_MetaFunction =>
  () => {
    return [
      {
        title,
        description,
        "og:title": title,
        "og:description": description,
        "twitter:title": title,
        "twitter:description": description,
        "og:image": img,
        "twitter:image": img,
      },
    ];
  };

export default getMeta;
