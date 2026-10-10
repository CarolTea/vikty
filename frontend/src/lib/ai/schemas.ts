import { z } from "zod";
const text = z.string().min(1).max(300);
const limitations = z.array(text).max(8);
export const clarificationSchema = z
  .object({
    ready: z.boolean(),
    question: text.nullable(),
    options: z.array(z.string().min(1).max(100)).max(6),
    reason: text,
  })
  .strict();
export const interpretationSchema = z
  .object({
    summary: z.string().min(10).max(2500),
    exposures: z
      .array(
        z
          .object({
            id: z
              .string()
              .min(1)
              .max(80)
              .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
            name: z.string().min(1).max(100),
            description: text,
            importance: z.enum(["primary", "secondary"]),
          })
          .strict(),
      )
      .max(8),
    limitations,
  })
  .strict();
export const allocationSchema = z
  .object({
    assetId: z.string().min(1).max(80),
    allocation: z.number().int().min(0).max(100),
    whyHere: text,
    riskContext: text,
  })
  .strict();
export const compositionSchema = z
  .object({
    summary: z.string().min(1).max(1000),
    assets: z.array(allocationSchema).max(6),
    limitations,
  })
  .strict();
export const answerSchema = z
  .object({
    kind: z.enum(["EXPLANATION_ONLY", "PROPOSED_CHANGE"]),
    explanation: z.string().min(1).max(2500),
    changes: z.array(allocationSchema).max(12),
    limitations,
  })
  .strict();
export type Clarification = z.infer<typeof clarificationSchema>;
export type Interpretation = z.infer<typeof interpretationSchema>;
export type CompositionProposal = z.infer<typeof compositionSchema>;
export type ThesisAnswer = z.infer<typeof answerSchema>;
export type CompositionInput = {
  belief: string;
  interpretation: Interpretation;
  candidates: import("../assets/types").CatalogAsset[];
};
export type AnswerInput = {
  belief: string;
  interpretation: string;
  exposures: import("../demo/types").Exposure[];
  assets: Array<{ id: string; allocation: number; active: boolean }>;
};
export type AnswerResult = {
  kind: ThesisAnswer["kind"];
  explanation: string;
  limitations: string[];
  proposedAssets: import("../demo/types").DemoAsset[] | null;
};
