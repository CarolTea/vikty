import { cn } from "@/lib/utils";
import logoAsset from "@/assets/logo-victy-transparent.png.asset.json";

export function VicTyLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <img
      src={logoAsset.url}
      alt="VicTy"
      className={cn(compact ? "h-9 w-12 object-cover object-left" : "h-10 w-auto", className)}
    />
  );
}
