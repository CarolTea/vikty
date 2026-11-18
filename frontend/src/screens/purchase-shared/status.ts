import type { PillTone } from '../../components';
import type { OperationStatus } from './types';

/** The one mapping from operation status to pill tone, shared by the review and operation screens. */
const TONE: Record<OperationStatus, PillTone> = {
  preparing: 'neutral',
  ready_for_review: 'neutral',
  awaiting_signature: 'warning',
  rejected: 'danger',
  sending: 'warning',
  pending: 'warning',
  confirmed: 'valid',
  failed: 'danger',
  expired: 'neutral',
  reconciling: 'warning',
};

export const statusTone = (status: OperationStatus): PillTone => TONE[status];

export const STEP_KEYS = ['review', 'signature', 'network', 'confirmation'] as const;

const STEP: Record<OperationStatus, number> = {
  preparing: 0,
  ready_for_review: 0,
  expired: 0,
  awaiting_signature: 1,
  rejected: 1,
  sending: 2,
  pending: 2,
  reconciling: 2,
  failed: 2,
  confirmed: STEP_KEYS.length,
};

/** Zero-based step in progress; equal to the step count when everything is done. */
export const statusStep = (status: OperationStatus): number => STEP[status];

/** Statuses the backend moves on its own: the screen keeps asking until they change. */
export const isPolled = (status: OperationStatus): boolean =>
  status === 'preparing' || status === 'sending' || status === 'pending' || status === 'reconciling';

export const isSettled = (status: OperationStatus): boolean =>
  status === 'confirmed' || status === 'failed' || status === 'rejected' || status === 'expired';
