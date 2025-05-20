import Fastify, { type FastifyInstance, type FastifySchema } from "fastify";
import FastifyWebsocket from "@fastify/websocket";

import { pool } from "./database.ts";
import { isValidAccessToken } from "./api/accessToken.ts";
import {
  getTeamPointsByRange,
  getUsersActivityPointsByRange,
  getUsersPointsByRange,
  testDbConnection,
} from "./services/pointsStorage.ts";
import {
  startIntervalPointsQuerying,
  stopIntervalPointsQuerying,
} from "./intervalQuery.ts";
import { initializeDatabase } from "./scripts/init-db.ts";

interface PointsQueryString {
  startDate: string;
  endDate: string;
}

const teamPointsQuerySchema: FastifySchema = {
  headers: {
    type: "object",
    required: ["authorization"],
    properties: {
      authorization: { type: "string" },
    },
  },
  querystring: {
    type: "object",
    required: ["startDate", "endDate"],
    properties: {
      startDate: { type: "string", format: "date-time" },
      endDate: { type: "string", format: "date-time" },
    },
  },
};

const activityPointsQuerySchema: FastifySchema = {
  headers: {
    type: "object",
    required: ["authorization"],
    properties: {
      authorization: { type: "string" },
    },
  },
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
    },
  },
  querystring: {
    type: "object",
    required: ["startDate", "endDate"],
    properties: {
      startDate: { type: "string", format: "date-time" },
      endDate: { type: "string", format: "date-time" },
    },
  },
};

const userPointsQuerySchema: FastifySchema = {
  headers: {
    type: "object",
    required: ["authorization"],
    properties: {
      authorization: { type: "string" },
    },
  },
  params: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "string" },
    },
  },
  querystring: {
    type: "object",
    required: ["startDate", "endDate"],
    properties: {
      startDate: { type: "string", format: "date-time" },
      endDate: { type: "string", format: "date-time" },
    },
  },
};

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const fastify: FastifyInstance = Fastify({
  logger: process.env.NODE_ENV === "development",
});

fastify.register(FastifyWebsocket, {
  options: {
    clientTracking: true,
  },
});

fastify.route({
  method: "GET",
  url: "/ws",
  wsHandler: async (websocket, request) => {
    websocket.close(401);
    // TODO handle auth
    // Probably another endpoint to get temporary key for ws, provide it via query string
    // Connect to ws with that key, discard the key
  },
  handler: () => {},
});

interface UserActivityPointsResponse {
  userId: string;
  activityId: string;
  time: Date;
  value: number;
  points: number;
}

fastify.get<{ Querystring: PointsQueryString; Params: { userId: string } }>(
  "/api/user-activity-points/:userId",
  { schema: activityPointsQuerySchema },
  async (request, reply) => {
    if (!(await isValidAccessToken(request.headers.authorization))) {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }

    const { userId } = request.params;
    const { startDate: startDateStr, endDate: endDateStr } = request.query;

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      await reply.code(400).send({
        error:
          "Invalid date format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ssZ)",
      });
      return;
    }
    if (start >= end) {
      await reply.code(400).send({ error: "startDate must be before endDate" });
      return;
    }
    if (start > now || end > now) {
      await reply.code(400).send({ error: "Dates cannot be in the future" });
      return;
    }

    try {
      const result = await getUsersActivityPointsByRange(userId, start, end);

      await reply.code(200).send(
        result.map<UserActivityPointsResponse>((x) => ({
          userId: x.user_id,
          activityId: x.activity_id,
          time: x.time,
          value: x.value,
          points: x.points,
        }))
      );
    } catch (error: unknown) {
      fastify.log.error({ err: error }, "Error executing query:");
      await reply.code(500).send({ error: "Failed to retrieve data." });
    }
  }
);

interface UserPointsResponse {
  userId: string;
  time: Date;
  points: number;
}

fastify.get<{ Querystring: PointsQueryString; Params: { userId: string } }>(
  "/api/user-points/:userId",
  { schema: userPointsQuerySchema },
  async (request, reply) => {
    if (!(await isValidAccessToken(request.headers.authorization))) {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    const { userId } = request.params;
    const { startDate: startDateStr, endDate: endDateStr } = request.query;

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      await reply.code(400).send({
        error:
          "Invalid date format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ssZ)",
      });
      return;
    }
    if (start >= end) {
      await reply.code(400).send({ error: "startDate must be before endDate" });
      return;
    }
    if (start > now || end > now) {
      await reply.code(400).send({ error: "Dates cannot be in the future" });
      return;
    }

    try {
      const result = await getUsersPointsByRange(userId, start, end);

      await reply.code(200).send(
        result.map<UserPointsResponse>((x) => ({
          userId: x.user_id,
          time: x.time,
          points: x.points,
        }))
      );
    } catch (error: unknown) {
      fastify.log.error({ err: error }, "Error executing query:");
      await reply.code(500).send({ error: "Failed to retrieve data." });
    }
  }
);

interface TeamPointsResponse {
  time: Date;
  teamId: string;
  points: number;
}

fastify.get<{ Querystring: PointsQueryString }>(
  "/api/team-points",
  { schema: teamPointsQuerySchema },
  async (request, reply) => {
    if (!(await isValidAccessToken(request.headers.authorization))) {
      await reply.code(401).send({ error: "Unauthorized" });
      return;
    }

    const { startDate: startDateStr, endDate: endDateStr } = request.query;

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      await reply.code(400).send({
        error:
          "Invalid date format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:mm:ssZ)",
      });
      return;
    }
    if (start >= end) {
      await reply.code(400).send({ error: "startDate must be before endDate" });
      return;
    }
    if (start > now || end > now) {
      await reply.code(400).send({ error: "Dates cannot be in the future" });
      return;
    }

    try {
      const result = await getTeamPointsByRange(start, end);

      await reply.code(200).send(
        result.map<TeamPointsResponse>((x) => ({
          teamId: x.team_id,
          time: x.time,
          points: x.points,
        }))
      );
    } catch (error: unknown) {
      fastify.log.error({ err: error }, "Error executing query:");
      await reply.code(500).send({ error: "Failed to retrieve data." });
    }
  }
);

async function startServer(): Promise<void> {
  try {
    await testDbConnection();

    await initializeDatabase();

    startIntervalPointsQuerying();

    await fastify.listen({ port: PORT, host: HOST });
  } catch (err) {
    fastify.log.error({ err }, "Application failed to start"); // Use fastify logger
    // Ensure pool is closed even if startup fails partially
    await pool
      .end()
      .catch((poolErr) =>
        fastify.log.error(
          { poolErr },
          "Error closing pool during failed startup"
        )
      );
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  console.log("\nReceived shutdown signal. Closing resources...");
  try {
    stopIntervalPointsQuerying();

    await fastify.close();
    console.log("Fastify server closed.");

    await pool.end();
    console.log("Database connection pool closed.");

    process.exit(0);
  } catch (error: unknown) {
    console.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
}

startServer().catch((e) => {
  console.error("startServer failed", e);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
