import { google } from "googleapis";
import * as argon2 from "argon2";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../../config/env";
import { getSupabase } from "../../config/supabase";
import { logger } from "../../utils/logger";
import { BadRequestError, UnauthorizedError, AccountSuspendedError } from "../../utils/errors";
import { getPermissions } from "../../middleware/roles";
import { COOKIE_NAMES, accessTokenCookie, refreshTokenCookie, userDataCookie } from "../../config/cookies";
import type { Response } from "express";

const oauth2Client = new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function getGoogleAuthUrl(state?: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "select_account",
    state: state || "",
  });
}

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
  verified_email: boolean;
}

async function getGoogleProfile(code: string): Promise<GoogleProfile> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  if (!data.email) throw new BadRequestError("Conta Google sem e-mail.");

  return {
    id: data.id || "",
    email: data.email,
    name: data.name || data.email.split("@")[0],
    picture: data.picture || "",
    verified_email: data.verified_email || false,
  };
}

function generateTokens(user: { id: string; email: string; role: string; full_name: string }) {
  const payload = { sub: user.id, email: user.email, role: user.role, name: user.full_name };
  const accessToken = jwt.sign({ ...payload, type: "access" }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as StringValue });
  const refreshToken = jwt.sign({ ...payload, type: "refresh" }, env.JWT_SECRET, { expiresIn: "30d" as StringValue });
  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  return { accessToken, refreshToken, expiresIn };
}

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string; expiresIn: number }, user: Record<string, unknown>) {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, accessTokenCookie(tokens.expiresIn * 1000));
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookie());
  res.cookie(COOKIE_NAMES.USER_DATA, JSON.stringify({
    id: user.id, full_name: user.full_name, email: user.email, role: user.role,
    avatar_url: user.avatar_url || null, oab_number: user.oab_number || null, oab_state: user.oab_state || null,
    permissions: getPermissions(user.role as string),
  }), userDataCookie());
}

export async function handleGoogleCallback(code: string, res: Response, ip: string | null, userAgent: string | null) {
  const profile = await getGoogleProfile(code);
  const db = getSupabase();

  let { data: user } = await db.from("users").select("*").eq("email", profile.email).is("deleted_at", null).maybeSingle();

  if (user) {
    if (user.status === "suspenso") throw new AccountSuspendedError();
    if (user.status === "inativo") throw new UnauthorizedError("Conta inativa.");

    await db.from("users").update({
      avatar_url: user.avatar_url || profile.picture,
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      login_count: (user.login_count || 0) + 1,
      failed_login_count: 0,
      locked_until: null,
      metadata: { ...(user.metadata || {}), google_id: profile.id, last_google_login: new Date().toISOString() },
    }).eq("id", user.id);

    await db.from("login_history").insert({
      user_id: user.id, success: true, ip_address: ip, user_agent: userAgent?.slice(0, 500), failure_reason: null,
    });

    user = (await db.from("users").select("*").eq("id", user.id).single()).data;
  } else {
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await argon2.hash(randomPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });

    const { data: newUser, error } = await db.from("users").insert({
      full_name: profile.name,
      email: profile.email,
      avatar_url: profile.picture,
      role: "advogado",
      status: "ativo",
      is_verified: profile.verified_email,
      verified_at: profile.verified_email ? new Date().toISOString() : null,
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      login_count: 1,
      metadata: { google_id: profile.id, registered_via: "google" },
    }).select().single();

    if (error || !newUser) throw new Error(error?.message || "Erro ao criar usuario.");

    await db.from("user_credentials").insert({ user_id: newUser.id, password_hash: passwordHash });

    await db.from("login_history").insert({
      user_id: newUser.id, success: true, ip_address: ip, user_agent: userAgent?.slice(0, 500), failure_reason: null,
    });

    user = newUser;
    logger.info("Google user registered", { userId: newUser.id, email: profile.email });
  }

  const tokens = generateTokens(user);
  setAuthCookies(res, tokens, user);

  await db.from("user_sessions").insert({
    user_id: user.id, refresh_token: tokens.refreshToken, ip_address: ip,
    user_agent: userAgent?.slice(0, 500), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });

  logger.info("Google login", { userId: user.id, email: user.email, ip, isNewUser: !!(user.metadata as Record<string, unknown>)?.registered_via });

  const { two_factor_secret, ...safeUser } = user;
  return { user: safeUser, tokens, permissions: getPermissions(user.role) };
}
