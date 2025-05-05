import createClient from "openapi-fetch";
import type { paths } from "./squadEasyApi";

const squadEasyClient = createClient<paths>({
  baseUrl: "https://api-challenge.squadeasy.com",
});

export async function queryMyChallenge(accessToken: string) {
  const result = await squadEasyClient.GET("/api/3.0/my/challenge", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!result.data)
    throw new Error(`Request failed ${JSON.stringify(result.error)}`);
  return result.data;
}

export async function queryUserById(accessToken: string, userId: string) {
  const result = await squadEasyClient.GET("/api/2.0/users/{id}", {
    params: {
      path: {
        id: userId,
      },
    },
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!result.data)
    throw new Error(`Request failed ${JSON.stringify(result.error)}`);
  return result.data;
}

export async function queryMyUser(accessToken: string, userId: string) {
  const result = await squadEasyClient.GET("/api/2.0/my/user", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!result.data)
    throw new Error(`Request failed ${JSON.stringify(result.error)}`);
  return result.data;
}

export async function queryMyTeam(accessToken: string, userId: string) {
  const result = await squadEasyClient.GET("/api/2.0/my/team", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!result.data)
    throw new Error(`Request failed ${JSON.stringify(result.error)}`);
  return result.data;
}

export async function querySeasonRanking(accessToken: string) {
  const result = await squadEasyClient.GET(
    "/api/3.0/ranking/{type}/{seasonId}",
    {
      params: {
        path: {
          seasonId: "a",
          type: "a",
        },
      },
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!result.data)
    throw new Error(`Get teams failed ${JSON.stringify(result.error)}`);
  return result.data;
}

export async function queryTeamById(accessToken: string, teamId: string) {
  const result = await squadEasyClient.GET("/api/2.0/teams/{id}", {
    params: {
      path: {
        id: teamId,
      },
    },
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!result.data)
    throw new Error(`Get team failed ${JSON.stringify(result.error)}`);
  return result.data;
}

export async function queryUserStatisticsQuery(
  accessToken: string,
  userId: string
) {
  const result = await squadEasyClient.GET("/api/2.0/users/{id}/statistics", {
    params: {
      path: {
        id: userId,
      },
    },
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!result.data)
    throw new Error(
      `Get user statistics failed ${JSON.stringify(result.error)}`
    );
  return result.data;
}

export async function mutationRefreshToken(
  accessToken: string,
  refreshToken: string
) {
  const loginResult = await squadEasyClient.POST(
    "/api/3.0/auth/refresh-token",
    {
      params: {
        header: {
          Authorization: `Bearer ${accessToken}`,
          "Refresh-Token": refreshToken,
        },
      },
    }
  );
  if (!loginResult.data)
    throw new Error(`Login failed ${JSON.stringify(loginResult.error)}`);
  return loginResult.data;
}

export async function mutationLogin(email: string, password: string) {
  const loginResult = await squadEasyClient.POST("/api/3.0/auth/login", {
    body: {
      email: email,
      password: password,
    },
  });
  if (!loginResult.data)
    throw new Error(`Login failed ${JSON.stringify(loginResult.error)}`);

  const myUserResult = await squadEasyClient.GET("/api/2.0/my/user", {
    headers: {
      authorization: `Bearer ${loginResult.data.accessToken}`,
    },
  });
  if (!myUserResult.data)
    throw new Error(
      `Get My User details failed ${JSON.stringify(myUserResult.error)}`
    );

  return {
    myUser: myUserResult.data,
    accessToken: loginResult.data.accessToken,
    refreshToken: loginResult.data.refreshToken,
  };
}
