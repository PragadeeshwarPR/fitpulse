import { z } from "zod";

export const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

/** At least 8 chars with upper, lower, digit and symbol. */
export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Password needs a lowercase letter")
  .regex(/[A-Z]/, "Password needs an uppercase letter")
  .regex(/[0-9]/, "Password needs a number")
  .regex(/[^A-Za-z0-9]/, "Password needs a symbol");

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email });
export const tokenSchema = z.object({ token: z.string().min(10).max(200) });
export const resetSchema = z
  .object({ token: z.string().min(10).max(200), password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords do not match", path: ["confirmPassword"] });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
export const deleteAccountSchema = z.object({ password: z.string().min(1), confirm: z.literal("DELETE") });
