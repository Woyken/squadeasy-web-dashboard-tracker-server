import { getAccessToken } from "./api/accessToken.ts";
import {
  queryMyChallenge,
  querySeasonRanking,
  queryTeamById,
  queryUserStatisticsQuery,
} from "./api/client.ts";
import {
  getLatestPointsForTeams,
  getLatestPointsForUserActivities,
  getLatestPointsForUsers,
  storeTeamData,
  storeUserActivities,
  storeUsersPoints,
} from "./services/pointsStorage.ts";

async function handleFetchUserActivities(
  accessToken: string,
  userIds: string[]
) {
  console.log("handling user activity fetching for ", userIds.length, " users");
  const usersActivitiesPromises = userIds.map((userId) =>
    queryUserStatisticsQuery(accessToken, userId)
  );
  const lastUsersActivities = await getLatestPointsForUserActivities(userIds);

  const userActivities = await Promise.all(usersActivitiesPromises);

  const now = Date.now();

  const userActivitiesFlat = userActivities.flatMap((x) =>
    x.activities.map((a) => ({ userId: x.id, ...a }))
  );

  const onlyChangedUserActivities = userActivitiesFlat.filter((newUser) => {
    const lastPointsAndValue = lastUsersActivities.find(
      (activity) =>
        activity.user_id === newUser.userId &&
        activity.activity_id === newUser.activityId
    );
    if (
      newUser.points !== lastPointsAndValue?.points ||
      newUser.value !== lastPointsAndValue.value
    )
      return true;

    return false;
  });

  await storeUserActivities(now, onlyChangedUserActivities);
}

async function fetchTeamUsersPoints(accessToken: string, id: string) {
  const teamUsersPoints = await queryTeamById(accessToken, id);
  const teamUsers = teamUsersPoints.users.map((x) => ({
    id: x.id,
    points: x.points,
    isActivityPublic: x.isActivityPublic,
  }));
  return teamUsers;
}

async function handleFetchTeamsUsersPoints(
  accessToken: string,
  teamIds: string[]
) {
  console.log(
    "handling teams users points fetching for ",
    teamIds.length,
    " teams"
  );
  const teamsUsersQueries = teamIds.map((teamId) =>
    fetchTeamUsersPoints(accessToken, teamId)
  );
  const teamsUsersPoints = await Promise.all(teamsUsersQueries);
  const teamsUsersFlat = teamsUsersPoints.flatMap((x) => x);

  const lastUsersPoints = await getLatestPointsForUsers(
    teamsUsersFlat.map((x) => x.id)
  );
  const now = Date.now();

  const onlyChangedUsersScores = teamsUsersFlat.filter((newUser) => {
    const lastUserPoints = lastUsersPoints.find(
      (x) => x.user_id === newUser.id
    )?.points;
    if (newUser.points !== lastUserPoints) return true;

    return false;
  });

  if (onlyChangedUsersScores.length === 0) {
    console.log("no users scores changed");
    return;
  }

  handleFetchUserActivities(
    accessToken,
    onlyChangedUsersScores.filter((x) => !!x.isActivityPublic).map((x) => x.id)
  ).catch((e) => console.error("failed to update users activities", e));

  await storeUsersPoints(now, onlyChangedUsersScores);
}

async function handleScheduledTeamsFetch() {
  console.log(`\n--- ${new Date().toISOString()} ---`);
  console.log("Running scheduled task: Fetch and Store Team Data");
  const accessToken = await getAccessToken();
  const isChallenge = await getIsChallengeOngoing(accessToken);
  if (!isChallenge) {
    console.log("Challenge not in progress, skipping");
    return;
  }
  const lastTeamsPoints = await getLatestPointsForTeams();
  const now = Date.now();
  const teamsDataResponse = await querySeasonRanking(accessToken);

  const onlyChangedTeamsScores = teamsDataResponse.teams
    .map((newTeam) => {
      const lastTeamScore = lastTeamsPoints.find(
        (x) => x.team_id === newTeam.id
      )?.points;

      if (newTeam.points !== lastTeamScore) return newTeam;
    })
    .filter((x) => !!x);

  if (onlyChangedTeamsScores.length === 0) {
    console.log("no teams scores changed");
    return;
  }

  const changedTeamIds = onlyChangedTeamsScores.map((x) => x.id);
  handleFetchTeamsUsersPoints(accessToken, changedTeamIds).catch((e) =>
    console.error("failed to update teams users", e)
  );

  await storeTeamData(now, onlyChangedTeamsScores);
  console.log("scheduled task finished.");
}

async function getIsChallengeOngoing(accessToken: string) {
  const challenge = await queryMyChallenge(accessToken);
  const startAt = new Date(challenge.startAt).getTime();
  const endAt = new Date(challenge.endAt).getTime();
  const now = Date.now();

  if (startAt > now) return false;
  if (endAt < now) return false;
  return true;
}

function runWithInterval(callback: () => void, delay: number) {
  callback();
  return setInterval(callback, delay);
}

let intervalId: NodeJS.Timeout | undefined = undefined;

export function startIntervalPointsQuerying() {
  intervalId = runWithInterval(() => {
    handleScheduledTeamsFetch().catch((e) => {
      console.error("failed scheduled teams fetch task", e);
    });
  }, 1 * 60 * 1000);
}

export function stopIntervalPointsQuerying() {
  clearInterval(intervalId);
}
