// What the session needs to know about a wallet's plan and in-flight operations.
export interface PlanLookup {
  activePlanId(wallet: string): Promise<string | null>;
  activeOperationIds(wallet: string): Promise<string[]>;
}

// Placeholder until plans and operations are persisted: no wallet has any yet, so these answers
// are true today. Replace with the database-backed lookup when those tables exist.
export const noPlansYet: PlanLookup = {
  activePlanId: async () => null,
  activeOperationIds: async () => [],
};
