import {
  ArrowRight, Ban, CircleHelp, CircleX, Eye, Hand, KeyRound, List, Scale, Wallet,
  AlertTriangle, Check, CheckCircle2, ChevronDown, Cpu, Database, DollarSign, ExternalLink, FileText, Info,
  Lock, Pencil, Search, Server, Shield, Sparkles, Undo2, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS = {
  alert: AlertTriangle,
  check: Check,
  'check-circle': CheckCircle2,
  info: Info,
  lock: Lock,
  undo: Undo2,
  'chevron-down': ChevronDown,
  external: ExternalLink,
  sparkle: Sparkles,
  search: Search,
  edit: Pencil,
  cpu: Cpu,
  server: Server,
  zap: Zap,
  dollar: DollarSign,
  file: FileText,
  database: Database,
  shield: Shield,
  'arrow-right': ArrowRight,
  ban: Ban,
  help: CircleHelp,
  'x-circle': CircleX,
  eye: Eye,
  hand: Hand,
  key: KeyRound,
  list: List,
  scale: Scale,
  wallet: Wallet,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** Decorative line icon (Lucide, 1.75 stroke). Meaning always comes from the text next to it. */
export function Icon({ name, size = 18, className }: IconProps) {
  const Svg = ICONS[name];
  return <Svg className={cx('vt-icon', className)} size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
