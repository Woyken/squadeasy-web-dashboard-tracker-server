import type { QueryResult } from "pg";
import { pool } from "../database.ts";

export async function getLatestPointsForUserActivities(userIds: string[]) {
  const queryString = `
  select time, user_id, activity_id, value, points
  from user_activity_points tp
  where tp.time = (
    select max(tp1.time)
    from user_activity_points tp1
    where tp1.user_id = tp.user_id
  ) and tp.user_id in ($1)`;
  const result: QueryResult<{
    time: string;
    user_id: string;
    activity_id: string;
    value: number;
    points: number;
  }> = await pool.query(queryString, [[...userIds]]);
  return result.rows;
}

export async function getLatestPointsForUsers(userIds: string[]) {
  const queryString = `
  select time, user_id, points
  from user_points tp
  where tp.time = (
    select max(tp1.time)
    from user_points tp1
    where tp1.user_id = tp.user_id
  ) and tp.user_id in ($1)`;
  const result: QueryResult<{ time: Date; user_id: string; points: number }> =
    await pool.query(queryString, [[...userIds]]);
  return result.rows;
}

export async function getLatestPointsForTeams() {
  const queryString = `
select time, team_id, points
from team_points tp
where tp.time = (
    select max(tp1.time)
    from team_points tp1
    where tp1.team_id = tp.team_id
)`;
  const result: QueryResult<{ time: Date; team_id: string; points: number }> =
    await pool.query(queryString);
  return result.rows;
}

export async function storeUserActivities(
  timestamp: number,
  activities: {
    userId: string;
    activityId: string;
    value: number;
    points: number;
  }[]
): Promise<void> {
  if (activities.length === 0) {
    console.log("No activities data provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store data for ${
      activities.length
    } activities at ${insertTime.toISOString()} using pg pool.`
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertQuery =
      "INSERT INTO user_activity_points(time, user_id, activity_id, value, points) VALUES($1, $2, $3, $4, $5)";

    for (const activity of activities) {
      await client.query(insertQuery, [
        insertTime.toISOString(),
        activity.userId,
        activity.activityId,
        activity.value,
        activity.points,
      ]);
    }

    await client.query("COMMIT");
    console.log(
      `Successfully stored ${activities.length} records using pg pool.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error storing data:", error);
  } finally {
    client.release();
  }
}

export async function storeUsersPoints(
  timestamp: number,
  users: {
    id: string;
    points: number;
  }[]
): Promise<void> {
  if (users.length === 0) {
    console.log("No users data provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store data for ${
      users.length
    } users at ${insertTime.toISOString()} using pg pool.`
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertQuery =
      "INSERT INTO user_points(time, user_id, points) VALUES($1, $2, $3)";

    for (const user of users) {
      await client.query(insertQuery, [
        insertTime.toISOString(),
        user.id,
        user.points,
      ]);
    }

    await client.query("COMMIT");
    console.log(`Successfully stored ${users.length} records using pg pool.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error storing data:", error);
  } finally {
    client.release();
  }
}

export async function storeTeamData(
  timestamp: number,
  teams: {
    id: string;
    points?: number;
  }[]
): Promise<void> {
  if (!teams || teams.length === 0) {
    console.log("No team data provided to store.");
    return;
  }

  const insertTime = new Date(timestamp);
  console.log(
    `Attempting to store data for ${
      teams.length
    } teams at ${insertTime.toISOString()} using pg pool.`
  );

  const validTeams = teams.filter(
    (team) => typeof team.id === "string" && typeof team.points === "number"
  );

  if (validTeams.length === 0) {
    console.log("No valid team records to insert after filtering.");
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertQuery =
      "INSERT INTO team_points(time, team_id, points) VALUES($1, $2, $3)";

    for (const team of validTeams) {
      await client.query(insertQuery, [
        insertTime.toISOString(),
        team.id,
        team.points,
      ]);
    }

    await client.query("COMMIT");
    console.log(
      `Successfully stored ${validTeams.length} records using pg pool.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error storing data:", error);
  } finally {
    client.release();
  }
}

export async function testDbConnection(): Promise<void> {
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT NOW()");
    console.log(
      "Successfully connected to TimescaleDB via node-postgres pool."
    );
  } catch (error) {
    console.error(
      "Unable to connect to the database via node-postgres pool:",
      error
    );
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
  }
}

export async function getTeamPointsByRange(
  start: Date,
  end: Date,
  requiresAggregation: boolean
) {
  let queryString = "";
  if (requiresAggregation) {
    // Aggregated Query
    console.info("Building aggregated query (6-hour buckets)...");
    queryString = `
          SELECT time_bucket('6 hours', "time") AS "time", team_id, LAST(points, "time") AS points
          FROM team_points WHERE "time" >= $1 AND "time" < $2
          GROUP BY 1, team_id ORDER BY "time" ASC, team_id ASC;`; // Use 1 for first SELECT column
  } else {
    // SELECT team_id, time FROM team_points ORDER BY time DESC LIMIT 1 ;
    // Detailed Query
    console.info("Building detailed query...");
    queryString = `
          SELECT time, team_id, points FROM team_points
          WHERE "time" >= $1 AND "time" < $2
          ORDER BY "time" ASC, team_id ASC;`;
  }

  console.info(
    `Executing query: ${queryString.replace(/\s+/g, " ").trim()} with params:`,
    [start.toISOString(), end.toISOString()]
  );

  // Execute query using the pool
  const result: QueryResult<{ time: Date; team_id: string; points: number }> =
    await pool.query(queryString, [start.toISOString(), end.toISOString()]);

  return result.rows;
}

export async function getUsersPointsByRange(start: Date, end: Date) {
  let queryString = `
    SELECT time, user_id, points FROM user_points
    WHERE "time" >= $1 AND "time" < $2
    ORDER BY "time" ASC, user_id ASC;`;

  console.info(
    `Executing query: ${queryString.replace(/\s+/g, " ").trim()} with params:`,
    [start.toISOString(), end.toISOString()]
  );

  // Execute query using the pool
  const result: QueryResult<{ time: Date; user_id: string; points: number }> =
    await pool.query(queryString, [start.toISOString(), end.toISOString()]);

  return result.rows;
}

export async function getUsersActivityPointsByRange(start: Date, end: Date) {
  let queryString = `
      SELECT time, user_id, activity_id, value, points FROM user_activity_points
      WHERE "time" >= $1 AND "time" < $2
      ORDER BY "time" ASC, user_id ASC;`;

  console.info(
    `Executing query: ${queryString.replace(/\s+/g, " ").trim()} with params:`,
    [start.toISOString(), end.toISOString()]
  );

  // Execute query using the pool
  const result: QueryResult<{
    time: Date;
    user_id: string;
    activity_id: string;
    value: number;
    points: number;
  }> = await pool.query(queryString, [start.toISOString(), end.toISOString()]);

  return result.rows;
}
