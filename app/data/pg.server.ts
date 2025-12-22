import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

const getPostgres = async () => {
  return drizzle(new Client({ connectionString: process.env.DATABASE_URL ?? "" }));
};

export default getPostgres;
