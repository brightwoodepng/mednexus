export function TutorialProgress({ current, total }: { current: number; total: number }) {
  return <div aria-label={`Step ${current + 1} of ${total}`} className="flex items-center gap-2"><span className="text-xs font-bold">{current + 1} / {total}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${((current + 1) / total) * 100}%` }}/></div></div>
}
