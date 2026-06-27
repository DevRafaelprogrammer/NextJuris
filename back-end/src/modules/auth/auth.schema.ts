import { z } from "zod";

const brStates = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

const passwordRule = z
  .string()
  .min(8, "Senha deve ter pelo menos 8 caracteres")
  .max(128)
  .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiuscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minuscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos um numero")
  .regex(/[^A-Za-z0-9]/, "Senha deve conter pelo menos um caractere especial");

function validateCpfDigits(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  let s = 0; for (let i = 0; i < 9; i++) s += parseInt(digits[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== parseInt(digits[9])) return false;
  s = 0; for (let i = 0; i < 10; i++) s += parseInt(digits[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0; if (r !== parseInt(digits[10])) return false;
  return true;
}

const cpfRule = z.string()
  .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, "Formato de CPF invalido")
  .refine((v) => validateCpfDigits(v), "Digitos verificadores do CPF invalidos")
  .transform((v) => {
    const d = v.replace(/\D/g, "");
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  });

const phoneRule = z.string().regex(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, "Telefone invalido").transform((v) => {
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
});

export const registerStep1Schema = z.object({
  fullName: z.string().min(3, "Informe nome e sobrenome").max(200).trim()
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  cpf: cpfRule,
  email: z.string().email("E-mail invalido").toLowerCase().trim(),
  phone: phoneRule.optional(),
});

export const registerStep2Schema = z.object({
  oabNumber: z.string().min(3, "Numero OAB obrigatorio").max(10)
    .regex(/^\d{3,6}$/, "Numero OAB invalido (3 a 6 digitos)"),
  oabState: z.enum(brStates, { message: "Seccional OAB invalida" }),
  area: z.string().min(3, "Selecione uma area de atuacao").max(100),
  officeName: z.string().max(200).optional(),
  officeCnpj: z.string().max(18).optional(),
  comarca: z.string().max(100).optional(),
  specialties: z.array(z.string().max(50)).max(10).default([]),
});

export const registerStep3Schema = z.object({
  password: passwordRule,
  confirmPassword: z.string(),
  acceptTerms: z.literal(true, { message: "Aceite os termos de uso" }),
  acceptLgpd: z.literal(true, { message: "Aceite a politica de privacidade (LGPD)" }),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Senhas nao conferem",
  path: ["confirmPassword"],
});

export const fullRegisterSchema = z.object({
  fullName: z.string().min(3, "Informe nome e sobrenome").max(200).trim()
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  cpf: cpfRule.optional(),
  email: z.string().email("E-mail invalido").toLowerCase().trim(),
  phone: phoneRule.optional(),
  oabNumber: z.string().max(10).optional(),
  oabState: z.enum(brStates).optional(),
  area: z.string().max(100).optional(),
  officeName: z.string().max(200).optional(),
  officeCnpj: z.string().max(18).optional(),
  comarca: z.string().max(100).optional(),
  specialties: z.array(z.string().max(50)).max(10).default([]),
  password: passwordRule,
  confirmPassword: z.string(),
  acceptTerms: z.boolean().default(false),
  acceptLgpd: z.boolean().default(false),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Senhas nao conferem",
  path: ["confirmPassword"],
});

export const registerSchema = fullRegisterSchema;

export const validateFieldSchema = z.object({
  field: z.enum(["email", "cpf", "oabNumber", "phone"]),
  value: z.string(),
  oabState: z.string().optional(),
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

export type RegisterStep1Input = z.infer<typeof registerStep1Schema>;
export type RegisterStep2Input = z.infer<typeof registerStep2Schema>;
export type RegisterStep3Input = z.infer<typeof registerStep3Schema>;
export type RegisterInput = z.infer<typeof fullRegisterSchema>;
export type ValidateFieldInput = z.infer<typeof validateFieldSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
