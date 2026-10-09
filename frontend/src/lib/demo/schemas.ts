import { z } from "zod";

export const credentialsSchema = z.object({
  id: z.string().uuid(),
  secret: z.string().min(40).max(200),
});
export const messageSchema = z.object({
  id: z.string().max(100),
  role: z.enum(["user", "assistant"]),
  text: z.string().max(3000),
  options: z.array(z.string().max(100)).max(8).optional(),
});
export const exposureSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(100),
  description: z.string().max(300),
  importance: z.enum(["primary", "secondary"]).optional(),
});
export const assetSchema = z.object({
  id: z.string().max(80),
  ticker: z.string().max(20),
  name: z.string().max(120),
  allocation: z.number().min(0).max(100),
  exposure: z.string().max(200),
  why: z.string().max(300),
  risks: z.string().max(300),
  availability: z.string().max(100),
  category: z.string().max(100),
  price: z.number().nonnegative(),
  active: z.boolean(),
});
const investmentSchema = z.object({
  id: z.string().max(100),
  assetId: z.string().max(80),
  ticker: z.string().max(20),
  amount: z.number().nonnegative().max(1_000_000),
  provider: z.string().max(80),
  route: z.string().max(120),
  status: z.literal("simulated"),
  createdAt: z.string().datetime(),
  walletAddress: z.string().max(44).optional(),
  walletApproval: z.literal("verified").optional(),
  network: z.literal("solana:devnet").optional(),
  approvedAt: z.string().datetime().optional(),
});
export const stateSchema = z.object({
  step: z.enum(["input", "conversation", "interpretation", "composition"]),
  belief: z.string().max(2000),
  messages: z.array(messageSchema).max(30),
  clarificationCount: z.number().int().min(0).max(3),
  interpretation: z.string().max(4000),
  exposures: z.array(exposureSchema).max(8),
  assets: z.array(assetSchema).max(12),
  investments: z.array(investmentSchema).max(30),
  limitations: z.array(z.string().max(300)).max(16).optional(),
  compositionSummary: z.string().max(1000).optional(),
  catalogVersion: z.string().max(80).optional(),
});
