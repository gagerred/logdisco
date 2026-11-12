/** Ilustração de um disco de vinil: sulcos em verde e selo vermelho. */
export function Disco({ className, aneis = 7 }: { className?: string; aneis?: number }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="98" fill="#0c2315" />
      {Array.from({ length: aneis }).map((_, i) => (
        <circle
          key={i}
          cx="100"
          cy="100"
          r={90 - i * 7}
          fill="none"
          stroke="#2f7a47"
          strokeWidth="0.8"
          opacity={0.6 - i * 0.05}
        />
      ))}
      <path d="M100 100 L100 5 A95 95 0 0 1 182 52 Z" fill="#ffffff" opacity="0.05" />
      <circle cx="100" cy="100" r="30" fill="#b3262b" />
      <circle cx="100" cy="100" r="30" fill="none" stroke="#f3f7f2" strokeWidth="1" opacity="0.45" />
      <circle cx="100" cy="100" r="4" fill="#f3f7f2" />
    </svg>
  );
}
