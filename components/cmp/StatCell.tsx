/**
 * CMP.10 — the stat cell. Used by the act-end receipt, the death screen and
 * victory, so all three read as the same object at different temperatures.
 */
export function StatCell({
  label,
  value,
  tone = 'text-fg0',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-[3px] border border-dark3 bg-panel px-[10px] py-[9px]">
      <span className="font-mono text-[8px] leading-none tracking-[0.18em] text-fg2">{label}</span>
      <span className={`font-pixel text-[24px] leading-[0.9] ${tone}`}>{value}</span>
    </div>
  );
}
