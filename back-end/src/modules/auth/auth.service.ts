import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import crypto from "crypto";
import { getSupabase } from "../../config/supabase";
import { env } from "../../config/env";
import { UnauthorizedError, BadRequestError, ConflictError, TooManyRequestsError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput, ChangePasswordInput } from "./auth.schema";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthResult {
  user: Record<string, unknown>;
  tokens: TokenPair;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
  type: "access" | "refresh";
}

const ACCESS_TOKEN_EXPIRY = env.JWT_EXPIRES_IN as StringValue;
const REFRESH_TOKEN_EXPIRY = "30d" as StringValue;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

function generateTokens(user: { id: string; email: string; role: string; full_name: string }): TokenPair {
  const payload: Omit<JwtPayload, "type"> = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.full_name,
  };

  const accessToken = jwt.sign({ ...payload, type: "access" }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ ...payload, type: "refresh" }, env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

  return { accessToken, refreshToken, expiresIn };
}

function sanitizeUser(user: Record<string, unknown>): Record<string, unknown> {
  const { password_hash, two_factor_secret, reset_token, reset_token_expires, ...safe } = user;
  return safe;
}

async function recordLogin(userId: string, success: boolean, ip: string | null, userAgent: string | null, failureReason?: string): Promise<void> {
  const db = getSupabase();
  await db.from("login_history").insert({
    user_id: userId,
    success,
    ip_address: ip,
    user_agent: userAgent?.slice(0, 500),
    failure_reason: failureReason ?? null,
  });
}

export class AuthService {

  async register(input: RegisterInput): Promise<AuthResult> {
    const db = getSupabase();

    const { data: emailExists } = await db.from("users").select("id").eq("email", input.email).is("deleted_at", null).maybeSingle();
    if (emailExists) throw new ConflictError("E-mail ja cadastrado.");

    if (input.cpf) {
      const { data: cpfExists } = await db.from("users").select("id").eq("cpf", input.cpf).is("deleted_at", null).maybeSingle();
      if (cpfExists) throw new ConflictError("CPF ja cadastrado.");
    }

    if (input.oabNumber && input.oabState) {
      const { data: oabExists } = await db.from("users").select("id").eq("oab_number", input.oabNumber).eq("oab_state", input.oabState).is("deleted_at", null).maybeSingle();
      if (oabExists) throw new ConflictError("OAB ja cadastrada.");
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const { data: user, error: userError } = await db.from("users").insert({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      cpf: input.cpf ?? null,
      oab_number: input.oabNumber ?? null,
      oab_state: input.oabState ?? null,
      role: "advogado",
      status: "pendente",
      office_name: input.officeName ?? null,
      area: input.area ?? null,
    }).select().single();

    if (userError || !user) throw new Error(userError?.message || "Erro ao criar usuario");

    await db.from("user_credentials").insert({
      user_id: user.id,
      password_hash: passwordHash,
    });

    const tokens = generateTokens(user);

    await this.createSession(user.id, tokens.refreshToken, null, null);

    logger.info("User registered", { userId: user.id, email: input.email });

    return { user: sanitizeUser(user), tokens };
  }

  async login(input: LoginInput, ip: string | null, userAgent: string | null): Promise<AuthResult> {
    const db = getSupabase();

    const { data: user } = await db.from("users").select("*").eq("email", input.email).is("deleted_at", null).maybeSingle();

    if (!user) {
      throw new UnauthorizedError("E-mail ou senha incorretos.");
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      await recordLogin(user.id, false, ip, userAgent, "Conta bloqueada");
      throw new TooManyRequestsError(`Conta bloqueada. Tente novamente em ${minutesLeft} minutos.`);
    }

    if (user.status === "suspenso") {
      await recordLogin(user.id, false, ip, userAgent, "Conta suspensa");
      throw new UnauthorizedError("Conta suspensa. Entre em contato com o administrador.");
    }

    if (user.status === "inativo") {
      await recordLogin(user.id, false, ip, userAgent, "Conta inativa");
      throw new UnauthorizedError("Conta inativa.");
    }

    const { data: creds } = await db.from("user_credentials").select("password_hash").eq("user_id", user.id).single();

    if (!creds) {
      throw new UnauthorizedError("E-mail ou senha incorretos.");
    }

    const valid = await argon2.verify(creds.password_hash, input.password);

    if (!valid) {
      const newFailCount = (user.failed_login_count || 0) + 1;
      const lockUntil = newFailCount >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()
        : null;

      await db.from("users").update({
        failed_login_count: newFailCount,
        locked_until: lockUntil,
      }).eq("id", user.id);

      await recordLogin(user.id, false, ip, userAgent, `Senha incorreta (${newFailCount}/${MAX_FAILED_ATTEMPTS})`);

      if (lockUntil) {
        throw new TooManyRequestsError(`Conta bloqueada por ${LOCKOUT_MINUTES} minutos apos ${MAX_FAILED_ATTEMPTS} tentativas.`);
      }

      throw new UnauthorizedError("E-mail ou senha incorretos.");
    }

    await db.from("users").update({
      last_login_at: new Date().toISOString(),
      last_login_ip: ip,
      login_count: (user.login_count || 0) + 1,
      failed_login_count: 0,
      locked_until: null,
    }).eq("id", user.id);

    await recordLogin(user.id, true, ip, userAgent);

    const tokens = generateTokens(user);
    await this.createSession(user.id, tokens.refreshToken, ip, userAgent);

    logger.info("User logged in", { userId: user.id, email: user.email, ip });

    return { user: sanitizeUser(user), tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const db = getSupabase();

    let payload: JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_SECRET) as JwtPayload;
      if (payload.type !== "refresh") throw new Error("Not a refresh token");
    } catch {
      throw new UnauthorizedError("Refresh token invalido ou expirado.");
    }

    const { data: session } = await db.from("user_sessions")
      .select("*")
      .eq("refresh_token", refreshToken)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!session) {
      throw new UnauthorizedError("Sessao expirada ou revogada.");
    }

    const { data: user } = await db.from("users").select("*").eq("id", payload.sub).is("deleted_at", null).maybeSingle();
    if (!user || user.status === "suspenso" || user.status === "inativo") {
      throw new UnauthorizedError("Conta indisponivel.");
    }

    await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);

    const tokens = generateTokens(user);
    await this.createSession(user.id, tokens.refreshToken, session.ip_address, session.user_agent);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const db = getSupabase();
    await db.from("user_sessions").update({ revoked_at: new Date().toISOString() }).eq("refresh_token", refreshToken);
  }

  async logoutAll(userId: string): Promise<number> {
    const db = getSupabase();
    const { data } = await db.from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("revoked_at", null)
      .select("id");
    return data?.length || 0;
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<{ sent: boolean }> {
    const db = getSupabase();
    const { data: user } = await db.from("users").select("id, email, full_name").eq("email", input.email).is("deleted_at", null).maybeSingle();

    if (!user) return { sent: true };

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 3600000).toISOString();

    await db.from("user_credentials").update({
      reset_token: resetToken,
      reset_token_expires: expires,
    }).eq("user_id", user.id);

    logger.info("Password reset requested", { userId: user.id, email: user.email, token: resetToken.slice(0, 8) + "..." });

    return { sent: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ reset: boolean }> {
    const db = getSupabase();

    const { data: creds } = await db.from("user_credentials")
      .select("user_id, reset_token_expires")
      .eq("reset_token", input.token)
      .maybeSingle();

    if (!creds) throw new BadRequestError("Token invalido ou expirado.");
    if (new Date(creds.reset_token_expires) < new Date()) throw new BadRequestError("Token expirado. Solicite um novo.");

    const hash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });

    await db.from("user_credentials").update({
      password_hash: hash,
      reset_token: null,
      reset_token_expires: null,
      password_changed_at: new Date().toISOString(),
    }).eq("user_id", creds.user_id);

    await db.from("users").update({ password_changed_at: new Date().toISOString() }).eq("id", creds.user_id);

    await this.logoutAll(creds.user_id);

    logger.info("Password reset completed", { userId: creds.user_id });

    return { reset: true };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ changed: boolean }> {
    const db = getSupabase();

    const { data: creds } = await db.from("user_credentials").select("password_hash").eq("user_id", userId).single();
    if (!creds) throw new BadRequestError("Credenciais nao encontradas.");

    const valid = await argon2.verify(creds.password_hash, input.currentPassword);
    if (!valid) throw new UnauthorizedError("Senha atual incorreta.");

    const hash = await argon2.hash(input.newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });

    await db.from("user_credentials").update({
      password_hash: hash,
      password_changed_at: new Date().toISOString(),
    }).eq("user_id", userId);

    await db.from("users").update({ password_changed_at: new Date().toISOString() }).eq("id", userId);

    return { changed: true };
  }

  async getActiveSessions(userId: string) {
    const db = getSupabase();
    const { data } = await db.from("user_sessions")
      .select("id, ip_address, user_agent, created_at, expires_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    return data || [];
  }

  async getLoginHistory(userId: string, limit = 20) {
    const db = getSupabase();
    const { data } = await db.from("login_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return data || [];
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const db = getSupabase();
    await db.from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", userId);
  }

  private async createSession(userId: string, refreshToken: string, ip: string | null, userAgent: string | null): Promise<void> {
    const db = getSupabase();
    await db.from("user_sessions").insert({
      user_id: userId,
      refresh_token: refreshToken,
      ip_address: ip,
      user_agent: userAgent?.slice(0, 500) ?? null,
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
  }
}
