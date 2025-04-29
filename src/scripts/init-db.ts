import { pool } from "../database.ts";

const createTeamPointsTableSql = `
CREATE TABLE IF NOT EXISTS team_points (
    time TIMESTAMPTZ NOT NULL,
    team_id TEXT NOT NULL,
    points INTEGER NOT NULL
);`;

const createTeamPointsHypertableSql = `
SELECT create_hypertable('team_points', 'time', if_not_exists => TRUE);
`;

const createTeamPointsIndexSql = `
CREATE INDEX IF NOT EXISTS ix_team_id_time ON team_points (team_id, time DESC);
`;

const createUserPointsTableSql = `
CREATE TABLE IF NOT EXISTS user_points (
    time TIMESTAMPTZ NOT NULL,
    user_id TEXT NOT NULL,
    points INTEGER NOT NULL
);

SELECT create_hypertable('user_points', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS ix_user_id_time ON user_points (user_id, time DESC);
`;

const createUserActivityPointsTableSql = `
CREATE TABLE IF NOT EXISTS user_activity_points (
    time TIMESTAMPTZ NOT NULL,
    user_id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    value INTEGER NOT NULL,
    points INTEGER NOT NULL
);

SELECT create_hypertable('user_activity_points', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS ix_user_id_time ON user_activity_points (user_id, time DESC);
CREATE INDEX IF NOT EXISTS ix_user_id_activity_id_time ON user_activity_points (user_id, activity_id, time DESC);
`;

export async function initializeDatabase() {
  console.log("Attempting to initialize the database...");
  const client = await pool.connect();
  console.log("Database client connected.");

  try {
    await client.query("BEGIN");
    console.log("Transaction started.");

    console.log("Executing: CREATE TABLE IF NOT EXISTS team_points...");
    await client.query(createTeamPointsTableSql);
    console.log('Table "team_points" ensured.');

    console.log(
      "Executing: SELECT create_hypertable('team_points', 'time', if_not_exists => TRUE)..."
    );
    await client.query(createTeamPointsHypertableSql);
    console.log('Hypertable "team_points" ensured.');

    console.log("Executing: CREATE INDEX IF NOT EXISTS ix_team_id_time...");
    await client.query(createTeamPointsIndexSql);
    console.log('Index "ix_team_id_time" ensured.');

    console.log("executing createUserPointsTableSql", createUserPointsTableSql);
    await client.query(createUserPointsTableSql);
    console.log("createUserPointsTableSql ensured");

    console.log(
      "executing createUserActivityPointsTableSql",
      createUserActivityPointsTableSql
    );
    await client.query(createUserActivityPointsTableSql);
    console.log("createUserActivityPointsTableSql ensured");

    await client.query("COMMIT");
    console.log("Transaction committed successfully.");
    console.log("Database initialization complete.");
  } catch (error: unknown) {
    console.error(
      "Error during database initialization, rolling back transaction."
    );

    try {
      await client.query("ROLLBACK");
      console.log("Transaction rolled back.");
    } catch (rollbackError) {
      console.error("Failed to rollback transaction:", rollbackError);
    }

    if (error instanceof Error) {
      if ("routine" in error && "schema" in error) {
        const pgError = error as any;
        console.error(`Database Error: ${pgError.message}`);
        console.error(`  Detail: ${pgError.detail}`);
        console.error(`  Routine: ${pgError.routine}`);
        console.error(`  Code: ${pgError.code}`);
      } else {
        console.error("Initialization Error:", error.message);
        console.error(error.stack);
      }
    } else {
      console.error("An unknown error occurred during initialization:", error);
    }

    // shut down whole app, no point in trying to recover
    process.exit(1);
  } finally {
    client.release();
    console.log("Database client released.");
    // If this was one off script, should release the pool
    // await pool.end();
    // console.log("Database pool closed.");
  }
}
