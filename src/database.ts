// src/database.ts
import { Pool, type PoolConfig } from "pg";

// --- Database Configuration for node-postgres ---
const dbConfig: PoolConfig = {
  user: process.env.DB_USER!,
  host: process.env.DB_HOST!,
  database: process.env.DB_DATABASE!,
  password: process.env.DB_PASSWORD!,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  // Optional Pool settings:
  max: 10, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 5000, // How long to wait for a connection attempt
};

// --- Create the Connection Pool ---
// The pool manages multiple client connections.
// You ask the pool for a client when you need one.
const pool = new Pool(dbConfig);

// --- Event Listener for Errors ---
// Catch errors on idle clients to prevent crashes
pool.on("error", (err, client) => {
  console.error("Unexpected error on idle database client", err);
  // Depending on the error, you might want to exit or implement retry logic
  // process.exit(-1);
});

// --- Export the Pool ---
// Your application code will import this pool to interact with the DB
export { pool };

// You can also add helper functions here if needed, e.g., a function
// to easily run queries, but exporting the pool directly is common.
