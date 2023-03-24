import { eq } from "drizzle-orm/expressions";
import getMysql from "../../app/data/mysql.server";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import { v4 } from "uuid";
import { build as esbuild } from "esbuild";
import appPath from "../../package/scripts/internal/appPath";
import getDotEnvObject from "../../package/scripts/internal/getDotEnvObject";
import { sql as drizzleSql } from "drizzle-orm/sql";
import type { MySql2Database } from "drizzle-orm/mysql2/driver";
import { migrations } from "../../data/schema";

type MigrationProps = {
  connection: MySql2Database;
};

const migrate = async (connection: MySql2Database): Promise<number> => {
  const dir = "data/migrations";
  return connection
    .select()
    .from(migrations)
    .orderBy(migrations.startedAt)
    .then((applied) => {
      const runMigrations = (
        migrationsToRun: ((props: MigrationProps) => Promise<void>)[]
      ) =>
        migrationsToRun
          .reduce((p, c) => p.then(() => c({ connection })), Promise.resolve())
          .then(() => {
            connection.end();
            return 0;
          });
      const outDir = appPath(path.join(".cache", "migrations"));
      const local = fs.existsSync(dir)
        ? fs.readdirSync(dir).map((f) => ({
            filename: f,
            migrationName: f.replace(/\.[t|j]s/, ""),
            checksum: crypto
              .createHash("md5")
              .update(fs.readFileSync(path.join(dir, f)).toString())
              .digest("hex"),
            uuid: v4(),
          }))
        : [];
      const migrationsToRun = local.map((m, index) =>
        index < applied.length
          ? () => {
              const a = applied[index];
              if (a.migrationName !== m.migrationName) {
                return Promise.reject(
                  `Could not find applied migration ${a.migrationName} locally. Instead found ${m.migrationName}`
                );
              }
              if (!a.finishedAt) {
                return Promise.reject(
                  `Tried to run migration that had already started but failed. Please first remove migration record ${a.migrationName} before attempting to apply migrations again.`
                );
              }
              return connection
                .update(migrations)
                .set({ checksum: m.checksum })
                .where(eq(migrations.uuid, a.uuid))
                .then(() =>
                  console.log(
                    "Updated the checksum for migration",
                    m.migrationName
                  )
                );
            }
          : (props: MigrationProps) => {
              console.log(`Running migration ${m.migrationName}`);
              return connection
                .insert(migrations)
                .values({
                  uuid: m.uuid,
                  migrationName: m.migrationName,
                  checksum: m.checksum,
                  startedAt: new Date().toJSON(),
                })
                .then(() => {
                  const outfile = path.join(outDir, `${m.migrationName}.js`);
                  return esbuild({
                    outfile,
                    entryPoints: [appPath(path.join(dir, m.filename))],
                    platform: "node",
                    bundle: true,
                    define: getDotEnvObject(),
                    target: "node14",
                  }).then(() => import(outfile));
                })
                .then(
                  (mod) =>
                    mod.migrate as (props: MigrationProps) => Promise<unknown>
                )
                .then((mig) =>
                  mig(props).catch((e) => {
                    console.error(`Failed to run migration ${m.migrationName}`);
                    throw e;
                  })
                )
                .then(() =>
                  connection
                    .update(migrations)
                    .set({ finishedAt: new Date().toJSON() })
                    .where(eq(migrations.uuid, m.uuid))
                )
                .then(() => {
                  console.log(`Finished running migration ${m.migrationName}`);
                });
            }
      );
      if (!migrationsToRun.length) {
        console.log("No migrations to run. Exiting...");
        return 0;
      } else if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      console.log(
        "Running",
        migrationsToRun.length - applied.length,
        "migrations..."
      );
      return runMigrations(migrationsToRun);
    });
};

const PLAN_OUT_FILE = "out/migrations/apply.sql";

const apply = async ({
  sql,
  tf,
  bare,
}: {
  tf?: boolean;
  sql?: boolean;
  bare?: boolean;
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
  const cxn = await getMysql();
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
  } else {
    console.log("No mysql schema queries to run!");
  }
  if (!bare) await migrate(cxn);
  cxn.end();
  return 0;
};

export default apply;
