import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env";
import { ConflictError, UnauthorizedError } from "../../utils/errors";
import { RegisterInput, LoginInput } from "./auth.schema";

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
}

const users = new Map<string, User>();

export class AuthService {
  async register(input: RegisterInput): Promise<{ user: Omit<User, "passwordHash">; token: string }> {
    const existing = [...users.values()].find((u) => u.email === input.email);
    if (existing) throw new ConflictError("Email already registered");

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user: User = {
      id: uuidv4(),
      name: input.name,
      email: input.email,
      passwordHash,
      role: "user",
      createdAt: new Date(),
    };
    users.set(user.id, user);

    const token = this.generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async login(input: LoginInput): Promise<{ user: Omit<User, "passwordHash">; token: string }> {
    const user = [...users.values()].find((u) => u.email === input.email);
    if (!user) throw new UnauthorizedError("Invalid email or password");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid email or password");

    const token = this.generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  private generateToken(user: User): string {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as StringValue }
    );
  }
}
