import { parseJwt } from "../utils/parseJwt.ts";
import {
  mutationLogin,
  mutationRefreshToken,
  queryUserById,
} from "./client.ts";

// TODO store token in db
let currentRefreshToken = "";
let currentAccessToken = "";
let currentUserId = "";

export async function isValidAccessToken(accessTokenWithBearer?: string) {
  if (!accessTokenWithBearer) return false;
  if (!accessTokenWithBearer.startsWith("Bearer ")) return false;

  try {
    const parsed = parseJwt(accessTokenWithBearer.replace("Bearer ", ""));
    const tokenExpiresAt = parsed.exp * 1000;
    const isExpired = tokenExpiresAt < new Date().getTime();
    if (isExpired) return false;
  } catch (e) {
    return false;
  }

  // make sure current token is initialized;
  await getAccessToken();

  try {
    // Try to find "current" user with provided credentials.
    // If found assume it's the same challenge and allow it through
    const foundUser = await queryUserById(
      accessTokenWithBearer.replace("Bearer ", ""),
      currentUserId
    );
    if (foundUser.id !== currentUserId) return false;
  } catch (e) {
    return false;
  }

  return true;
}

export async function getAsyncTokenRaw() {
  if (!currentAccessToken || !currentRefreshToken) {
    console.log("access token doesn't exist yet, logging in...");
    const loginResult = await mutationLogin(
      process.env.EMAIL!,
      process.env.PASSWORD!
    );
    console.log("login success, user id:", loginResult.myUser.id);
    currentAccessToken = loginResult.accessToken;
    currentRefreshToken = loginResult.refreshToken;
    currentUserId = loginResult.myUser.id;

    return loginResult.accessToken;
  }

  const tokenExpiresAt = parseJwt(currentAccessToken).exp * 1000;
  const isExpired = tokenExpiresAt - 5 * 60 * 1000 < new Date().getTime();
  if (isExpired) {
    console.log("access token is expired, refreshing...");
    const response = await mutationRefreshToken(
      currentAccessToken,
      currentRefreshToken
    );

    console.log("token refresh success");
    currentAccessToken = response.accessToken;
    currentRefreshToken = response.refreshToken;

    return response.accessToken;
  }

  return currentAccessToken;
}

let tokenFetchingInProgressPromise: Promise<string> | undefined = undefined;

export async function getAccessToken() {
  if (tokenFetchingInProgressPromise) return tokenFetchingInProgressPromise;
  try {
    const newTokenPromise = getAsyncTokenRaw();
    tokenFetchingInProgressPromise = newTokenPromise;
    return await newTokenPromise;
  } finally {
    tokenFetchingInProgressPromise = undefined;
  }
}
