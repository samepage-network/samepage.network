import dotenv from "dotenv";
import { v4 } from "uuid";
import fs from "fs";
import getMysql from "../../app/data/mysql.server";
dotenv.config();

const run = async ({ file = "temp" }: { file?: string }): Promise<number> => {
  process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
  const runner = await import(`../${file}`).then((r) => r.default);
  getMysql().then((cxn) =>
    runner(cxn)
      .then((data: Record<string, unknown>) => {
        const filename = `/tmp/report-${v4()}.json`;
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
        console.log(`Report written to ${filename}`);
      })
      .catch((e: Error) => {
        console.error("Error running migration:");
        console.error(e);
      })
      .finally(() => cxn.end())
  );
  return 0;
};

export default run;
