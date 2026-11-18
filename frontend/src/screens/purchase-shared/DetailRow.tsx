import type { ReactNode } from 'react';

/** One label and value line of a details card. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vt-composition-head">
      <span className="vt-field-label">{label}</span>
      <span className="vt-num">{children}</span>
    </div>
  );
}
