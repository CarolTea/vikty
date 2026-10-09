import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assetSchema, credentialsSchema } from "./demo/schemas";

const walletAddress = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const issueSchema = z.object({
  credentials: credentialsSchema,
  walletAddress,
  asset: assetSchema.extend({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    ticker: z.string().regex(/^[a-zA-Z0-9._-]{1,20}$/),
  }),
  amount: z.number().positive().max(1000),
});
const proofSchema = z.object({
  credentials: credentialsSchema,
  challengeId: z.string().uuid(),
  walletAddress,
  signature: z.array(z.number().int().min(0).max(255)).length(64),
});

export const issueWalletApproval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => issueSchema.parse(input))
  .handler(async ({ data }) => {
    const { issueApproval } = await import("./wallet-approval.server");
    return issueApproval(data);
  });

// Verification, atomic consumption, and simulated execution are one server call.
// There is deliberately no separate public boolean-based execution endpoint.
export const verifyWalletApproval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => proofSchema.parse(input))
  .handler(async ({ data }) => {
    const { verifyApproval } = await import("./wallet-approval.server");
    return verifyApproval(data);
  });
