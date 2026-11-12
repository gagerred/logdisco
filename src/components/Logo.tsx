import { Disco } from "./Disco";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <Disco className="h-7 w-7 shrink-0" aneis={3} />
      <span>LogDisco</span>
    </span>
  );
}
