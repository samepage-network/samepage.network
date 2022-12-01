import https from "https";

const queryRoam = (query: string) => {
  const graph = "dvargas92495";
  const token = process.env.ROADMAP_ROAM_TOKEN || "";
  const args = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };
  return new Promise<{ body: string }>((resolve, reject) => {
    const req = https
      .request(
        `https://api.roamresearch.com/api/graph/${graph}/q`,
        args,
        (res) => {
          if (res.statusCode === 307 && res.headers.location) {
            const redirect = https.request(
              res.headers.location,
              args,
              (redirectRes) => {
                redirectRes.setEncoding("utf8");
                let body = "";
                redirectRes.on("data", (data) => {
                  body += data;
                });
                redirectRes.on("end", () => {
                  if (!redirectRes.statusCode) reject("Missing Status Code");
                  else if (
                    redirectRes.statusCode >= 200 &&
                    redirectRes.statusCode < 400
                  ) {
                    resolve({
                      body,
                    });
                  } else {
                    const err = new Error(body);
                    err.name = `${redirectRes.statusCode}`;
                    reject(err);
                  }
                });
                res.on("error", reject);
              }
            );
            redirect.write(JSON.stringify({ query }));
            redirect.end();
          } else {
            reject(
              new Error(
                `Expected an immediate redirect (307) and location, got: ${res.statusCode} and ${res.headers.location}`
              )
            );
          }
        }
      )
      .on("error", reject);
    req.write(JSON.stringify({ query }));
    req.end();
  });
};

export default queryRoam;
