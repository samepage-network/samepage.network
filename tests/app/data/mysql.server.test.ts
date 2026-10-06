import { expect, test } from "@playwright/test";
import mysql from "mysql2/promise";
import { v4 } from "uuid";
import getMysql from "../../../app/data/mysql.server";

const originalCreateConnection = mysql.createConnection;

test.afterEach(() => {
  mysql.createConnection = originalCreateConnection;
});

test("Database end closes the underlying MySQL connection", async () => {
  let endCalls = 0;
  const client = {
    end: async (): Promise<void> => {
      endCalls += 1;
    },
  } as unknown as mysql.Connection;

  const database = await getMysql(client);
  expect(database.$client).toBe(client);
  expect(typeof database.select).toBe("function");
  await database.end();
  expect(endCalls).toBe(1);
});

test("Database end propagates connection shutdown failures", async () => {
  const failure = new Error("Synthetic MySQL shutdown failure");
  const client = {
    end: async (): Promise<void> => {
      throw failure;
    },
  } as unknown as mysql.Connection;

  const database = await getMysql(client);
  await expect(database.end()).rejects.toBe(failure);
});

test("Connections created by getMysql expose the compatible end method", async () => {
  let connectionCalls = 0;
  let endCalls = 0;
  const client = {
    end: async (): Promise<void> => {
      endCalls += 1;
    },
  } as unknown as mysql.Connection;
  mysql.createConnection = async (): Promise<mysql.Connection> => {
    connectionCalls += 1;
    return client;
  };

  const database = await getMysql();
  await database.end();
  expect(connectionCalls).toBe(1);
  expect(endCalls).toBe(1);
});

test("Cached request connections retain compatible database cleanup", async () => {
  let connectionCalls = 0;
  let endCalls = 0;
  const client = {
    end: async (): Promise<void> => {
      endCalls += 1;
    },
  } as unknown as mysql.Connection;
  mysql.createConnection = async (): Promise<mysql.Connection> => {
    connectionCalls += 1;
    return client;
  };

  const requestId = v4();
  const firstDatabase = await getMysql(requestId);
  const secondDatabase = await getMysql(requestId);
  expect(firstDatabase.$client).toBe(client);
  expect(secondDatabase.$client).toBe(client);
  await secondDatabase.end();
  expect(connectionCalls).toBe(1);
  expect(endCalls).toBe(1);
});
