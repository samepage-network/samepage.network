import { and, eq } from "drizzle-orm/expressions";
import getMysql from "../../app/data/mysql.server";
import fs from "fs";
import { execSync } from "child_process";
import { v4 } from "uuid";
import { sql as drizzleSql } from "drizzle-orm/sql";
import { apps, quotas } from "../../data/schema";
import stripe from "../../app/data/stripe.server";

const PLAN_OUT_FILE = "out/migrations/apply.sql";

const apply = async ({
  sql,
  tf,
  logger,
}: {
  tf?: boolean;
  sql?: boolean;
  logger?: boolean;
} = {}): Promise<number> => {
  if (!sql) {
    // TODO - REMOVE
    execSync(`npx cdktf deploy --auto-approve`, {
      stdio: "inherit",
      env: tf
        ? {
            ...process.env,
            TF_ONLY: "true",
          }
        : { ...process.env },
    });
  }

  const content = fs.existsSync(PLAN_OUT_FILE)
    ? fs.readFileSync(PLAN_OUT_FILE).toString()
    : "";
  const cxn = await getMysql(v4(), { logger });
  if (content.length) {
    // TODO - set up planet scale branch and merge
    const queries = content.split(";").filter(Boolean);
    console.log("Running", queries.length, "mysql schema queries...");
    await queries.reduce(
      (p, c, i) =>
        p.then(() =>
          cxn
            .execute(drizzleSql.raw(c))
            .then(() => console.log("finished query", i + 1))
        ),
      Promise.resolve()
    );
    fs.rmSync(PLAN_OUT_FILE);
  } else {
    console.log("No mysql schema queries to run!");
  }

  if (process.env.NODE_ENV !== "production") {
    const appsInProd = await fetch(`https://api.samepage.network/apps`)
      .then((r) => r.json())
      .then((r) => r.apps as (typeof appsInLocal)[string][]);
    const appsInLocal = await cxn
      .select()
      .from(apps)
      .then((r) => Object.fromEntries(r.map((a) => [a.code, a])));
    const appsToMigrate = appsInProd
      .filter((a) => !appsInLocal[a.code])
      .map((a) => async () => {
        await cxn
          .insert(apps)
          .values(a)
          .onDuplicateKeyUpdate({ set: { originRegex: a.originRegex } });
        await cxn
          .update(apps)
          .set({
            id: Number(a.id),
          })
          .where(eq(apps.code, a.code));
      });
    const quotasInProd = await fetch(`https://api.samepage.network/quotas`)
      .then((r) => r.json())
      .then((r) => r.quotas as (typeof quotasInLocal)[string][]);
    const quotasInLocal = await cxn
      .select()
      .from(quotas)
      .then((r) =>
        Object.fromEntries(r.map((a) => [`${a.field}~${a.stripeId}`, a]))
      );
    const stripeMap = Object.fromEntries(
      await stripe.prices
        .list()
        .then((s) => s.data.map((p) => [p.metadata.live, p.id] as const))
    );
    const quotasToMigrate = quotasInProd
      .filter((a) => !quotasInLocal[`${a.field}~${a.stripeId}`])
      .map((a) => async () => {
        await cxn.insert(quotas).values(a);
        if (!a.stripeId) return;
        const stripeId = stripeMap[a.stripeId];
        if (!stripeId) return;
        await cxn
          .update(quotas)
          .set({
            stripeId,
          })
          .where(
            and(eq(quotas.field, a.field), eq(quotas.stripeId, a.stripeId))
          );
      });
    const queriesToRun = [...appsToMigrate, ...quotasToMigrate];

    console.log("Running", queriesToRun.length, "mysql data queries...");
    await queriesToRun.reduce(
      (p, c, i) =>
        p.then(() => c().then(() => console.log("finished query", i + 1))),
      Promise.resolve()
    );
  }

  cxn.end();
  return 0;
};

export default apply;
