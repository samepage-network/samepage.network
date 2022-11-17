import axios from "axios";

const getGithubDownloadUrl = (id: string) =>
  axios
    .get<{
      assets: { browser_download_url: string; name: string }[];
      tag_name: string;
    }>(
      `https://api.github.com/repos/samepage-network/${id}-samepage/releases/latest`
    )
    .then((r) => ({
      href:
        r.data.assets.find((n) => n.name === `${id}.zip`)
          ?.browser_download_url || "",
      version: r.data.tag_name,
    }));

export default getGithubDownloadUrl;
