import { z } from "zod";

const passwordRule = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .max(128)
  .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiuscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minuscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos um numero")
  .regex(/[^A-Za-z0-9]/, "Senha deve conter pelo menos um caractere especial");

export const registerSchema = z.object({
  fullName: z.string().min(3, "Informe nome e sobrenome").max(200).trim(),
  email: z.string().email("E-mail invalido").toLowerCase().trim(),
  password: passwordRule,
  confirmPassword: z.string(),
  phone: z.string().max(20).optional(),
  cpf: z.string().min(11).max(14).optional(),
  oabNumber: z.string().max(10).optional(),
  oabState: z.string().length(2).toUpperCase().optional(),
  officeName: z.string().max(200).optional(),
  area: z.string().max(100).optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Senhas nao conferem",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("E-mail invalido").toLowerCase().trim(),
  password: z.string().min(1, "Informe sua senha"),
  rememberMe: z.boolean().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail invalido").toLowerCase().trim(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: passwordRule,
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Senhas nao conferem",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newPassword: passwordRule,
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Senhas nao conferem",
  path: ["confirmPassword"],
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
