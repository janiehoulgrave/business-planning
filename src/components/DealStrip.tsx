import React from 'react';
import { SOURCES, sourceByKey } from '../config';
import { Deal, isComplete } from '../lib/types';

// One segment per deal, colored by its source once answered.
export const DealStrip: React.FC<{
  deals: Deal[];
  current?: number;
  onJump?: (i: number) => void;
  tall?: boolean;
  groupBySource?: boolean;
}> = ({ deals, current, onJump, tall, groupBySource }) => {
  const rank = (d: Deal) => (d.excluded ? 99 : SOURCES.findIndex((s) => s.key === d.source) + 1 || 50);
  const items = deals.map((d, i) => ({ d, i }));
  if (groupBySource) items.sort((a, b) => rank(a.d) - rank(b.d) || a.i - b.i);
  return (
  <div className={`flex gap-[3px] w-full ${tall ? 'h-10' : 'h-3'}`} role={onJump ? 'navigation' : undefined} aria-label="Your deals">
    {items.map(({ d, i }) => {
      const src = sourceByKey(d.source);
      const done = isComplete(d);
      const color = d.excluded ? 'transparent' : src ? src.color : '#d7dde4';
      const active = i === current;
      const label = `Deal ${i + 1}: ${d.address}${d.excluded ? ' (left out)' : src ? `, ${src.label}` : ', not answered yet'}`;
      return (
        <button
          key={d.id}
          type="button"
          title={label}
          aria-label={label}
          aria-current={active ? 'step' : undefined}
          disabled={!onJump}
          onClick={() => onJump?.(i)}
          className={`flex-1 min-w-[4px] rounded-[3px] transition-all ${onJump ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${
            active ? 'ring-2 ring-ink ring-offset-2 ring-offset-mist' : ''
          } ${d.excluded ? 'border border-dashed border-[#b9c3ce]' : ''}`}
          style={{ background: color, opacity: src && !done && !d.excluded ? 0.55 : 1 }}
        />
      );
    })}
  </div>
  );
};
