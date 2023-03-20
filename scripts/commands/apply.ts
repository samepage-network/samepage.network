import getMysqlConnection from "fuegojs/utils/mysql";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import mysql from "mysql2/promise";
import crypto from "crypto";
import { v4 } from "uuid";
import { build as esbuild } from "esbuild";
import appPath from "../../package/scripts/internal/appPath";
import getDotEnvObject from "../../package/scripts/internal/getDotEnvObject";

type MigrationProps = {
  connection: mysql.Connection;
};

const migrate = async (cxn: mysql.Connection): Promise<number> => {
  const dir = "data/migrations";
  const connection = await getMysqlConnection(cxn);
  const actualTableResults = await connection
    .execute(`show tables`)
    .then(([r]) => r as Record<string, string>[]);
  // doing a check before create table to get around planetscale DDL block until we implement branching in our workflows
  if (!actualTableResults.some((a) => Object.values(a)[0] === "_migrations")) {
    await connection.execute(
      `CREATE TABLE IF NOT EXISTS _migrations (
        uuid           VARCHAR(36)  NOT NULL,
        migration_name VARCHAR(191) NOT NULL,
        started_at     DATETIME(3)  NOT NULL,
        finished_at    DATETIME(3)  NULL,
        checksum       VARCHAR(64)  NOT NULL,

        PRIMARY KEY (uuid)
    )`
    );
  }
  return connection
    .execute(`SELECT * FROM _migrations ORDER BY started_at`)
    .then(([results]) => {
      const applied = (results || []) as {
        uuid: string;
        migration_name: string;
        started_at: string;
        finished_at: string;
        checksum: string;
      }[];
      const runMigrations = (
        migrationsToRun: ((props: MigrationProps) => Promise<void>)[]
      ) =>
        migrationsToRun
          .reduce((p, c) => p.then(() => c({ connection })), Promise.resolve())
          .then(() => {
            connection.destroy();
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
              if (a.migration_name !== m.migrationName) {
                return Promise.reject(
                  `Could not find applied migration ${a.migration_name} locally. Instead found ${m.migrationName}`
                );
              }
              if (!a.finished_at) {
                return Promise.reject(
                  `Tried to run migration that had already started but failed. Please first remove migration record ${a.migration_name} before attempting to apply migrations again.`
                );
              }
              return connection
                .execute(`UPDATE _migrations SET checksum = ? WHERE uuid = ?`, [
                  m.checksum,
                  a.uuid,
                ])
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
                .execute(
                  `INSERT INTO _migrations (uuid, migration_name, checksum, started_at) VALUES (?, ?, ?, ?)`,
                  [m.uuid, m.migrationName, m.checksum, new Date()]
                )
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
                  connection.execute(
                    `UPDATE _migrations SET finished_at = ? WHERE uuid = ?`,
                    [new Date(), m.uuid]
                  )
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

const PLAN_OUT_FILE = "out/apply-sql.txt";

const apply = async ({
  sql,
  bare,
}: {
  sql?: boolean;
  bare?: boolean;
} = {}): Promise<number> => {
  if (!sql) {
    // TODO - REMOVE
    execSync(`npx cdktf deploy --auto-approve`, {
      stdio: "inherit",
    });
  }

  const queries = fs.existsSync(PLAN_OUT_FILE)
    ? fs
        .readFileSync(PLAN_OUT_FILE)
        .toString()
        .split(";\n\n")
        .filter((s) => !!s)
    : [];
  const cxn = await getMysqlConnection();
  if (queries.length) {
    await queries
      .map((q, i, a) => async () => {
        console.log(`Running query ${i + 1} of ${a.length}:`);
        console.log(">", q);
        await cxn.execute(q);
        console.log("Done!");
        console.log("");
      })
      .reduce((p, c) => p.then(c), Promise.resolve());
  } else {
    console.log("No mysql schema queries to run!");
  }
  if (!bare) await migrate(cxn);
  cxn.destroy();
  return 0;
};

export default apply;
