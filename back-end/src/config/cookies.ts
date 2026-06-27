import { CookieOptions } from "express";
import { env } from "./env";

const isProduction = env.NODE_ENV === "production";

export const COOKIE_NAMES = {
  ACCESS_TOKEN: "nj_access",
  REFRESH_TOKEN: "nj_refresh",
  USER_DATA: "nj_user",
  SESSION_ID: "nj_sid",
  CSRF_TOKEN: "nj_csrf",
  PREFERENCES: "nj_prefs",
} as const;

export const COOKIE_SECRET = env.JWT_SECRET;

const baseCookieOpts: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" : "lax",
  path: "/",
  signed: true,
};

export function accessTokenCookie(maxAge?: number): CookieOptions {
  return {
    ...baseCookieOpts,
    maxAge: maxAge || 7 * 24 * 60 * 60 * 1000,
  };
}

export function refreshTokenCookie(): CookieOptions {
  return {
    ...baseCookieOpts,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  };
}

export function userDataCookie(): CookieOptions {
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
    signed: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function clearCookieOpts(path = "/"): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path,
    signed: true,
  };
}
