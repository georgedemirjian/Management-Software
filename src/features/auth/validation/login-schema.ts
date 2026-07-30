import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  // Only "not empty" here: password policy is enforced where passwords are
  // set, not at sign-in.
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;
