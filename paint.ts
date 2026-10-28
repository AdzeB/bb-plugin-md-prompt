import type { ComposerRichTextSpec } from '@get-bb/plugin-sdk/app';
import { decorateMarkdown, MAX_CHARS, PALETTE, type Decoration } from './vendor/md-prompt/mdprompt';

type Range = { from: number; to: number };
const keys = ['color', 'backgroundColor', 'dimColor', 'bold', 'italic', 'underline', 'strikethrough'] as const;
const colors = [...new Set([
  ...Object.values(PALETTE).filter(value => typeof value === 'string'), ...Object.values(PALETTE.token),
])];
const rules = [
  ...colors.map(color => ({ name: `fg-${color.slice(1)}`, css: `color:${color}` })),
  ...[PALETTE.codeBg, PALETTE.inlineBg].map(color => ({ name: `bg-${color.slice(1)}`, css: `background-color:${color}` })),
  { name: 'dim', css: 'opacity:0.6' },
  { name: 'bold', css: 'font-weight:700' },
  { name: 'italic', css: 'font-style:italic' },
  { name: 'underline', css: 'text-decoration-line:underline' },
  { name: 'strike', css: 'text-decoration-line:line-through' },
];
export const paintCss = rules.map(rule => `span.mdp-${rule.name}{${rule.css}}`).join('\n')
  + '\nspan.mdp-underline.mdp-strike{text-decoration-line:underline line-through}';

// A max-heap preserves upstream's last-run-wins priority for each style key.
function push(heap: number[], value: number) {
  let i = heap.length;
  heap.push(value);
  while (i > 0) {
    const parent = (i - 1) >>> 1;
    if (heap[parent] >= value) break;
    heap[i] = heap[parent];
    i = parent;
  }
  heap[i] = value;
}
function pop(heap: number[]) {
  const last = heap.pop();
  if (last === undefined || heap.length === 0) return;
  let i = 0;
  while (i * 2 + 1 < heap.length) {
    let child = i * 2 + 1;
    if (child + 1 < heap.length && heap[child + 1] > heap[child]) child++;
    if (heap[child] <= last) break;
    heap[i] = heap[child];
    i = child;
  }
  heap[i] = last;
}
function classFor(key: typeof keys[number], value: Decoration[typeof keys[number]]): string | undefined {
  if (key === 'color' && typeof value === 'string') return `fg-${value.slice(1)}`;
  if (key === 'backgroundColor' && typeof value === 'string') return `bg-${value.slice(1)}`;
  if (value !== true) return;
  if (key === 'dimColor') return 'dim';
  if (key === 'strikethrough') return 'strike';
  return key;
}
function paint(text: string): Map<string, Range[]> {
  const runs = decorateMarkdown(text);
  const events = runs.flatMap((run, index) => [
    { at: run.start, index, start: true }, { at: run.end, index, start: false },
  ]).sort((a, b) => a.at - b.at);
  const heaps = keys.map(key => ({ key, heap: new Array<number>() }));
  const grouped = new Map<string, Range[]>();
  let i = 0;
  while (i < events.length) {
    const from = events[i].at;
    do {
      const event = events[i++];
      if (event.start) {
        for (const { key, heap } of heaps) {
          if (runs[event.index][key] !== undefined) push(heap, event.index);
        }
      }
    } while (i < events.length && events[i].at === from);
    if (i === events.length) break;
    const to = events[i].at;
    for (const { key, heap } of heaps) {
      while (heap.length > 0 && runs[heap[0]].end <= from) pop(heap);
      if (heap.length === 0) continue;
      const name = classFor(key, runs[heap[0]][key]);
      if (name === undefined) continue;
      let ranges = grouped.get(name);
      if (ranges === undefined) { ranges = []; grouped.set(name, ranges); }
      const previous = ranges.at(-1);
      if (previous?.to === from) previous.to = to;
      else ranges.push({ from, to });
    }
  }
  return grouped;
}
export function createPaintEffects(): NonNullable<ComposerRichTextSpec['effects']> {
  // All rules see the same draft. Parse once, bounded for split panes.
  const cache = new Map<string, Map<string, Range[]>>();
  function rangesFor(text: string, name: string): readonly Range[] {
    if (text.length > MAX_CHARS) return [];
    let grouped = cache.get(text);
    if (grouped === undefined) {
      try { grouped = paint(text); } catch { grouped = new Map(); }
      if (cache.size >= 4) cache.delete(cache.keys().next().value ?? '');
      cache.set(text, grouped);
    }
    return grouped.get(name) ?? [];
  }
  return rules.map(({ name }) => ({ id: `mdp-${name}`, className: `mdp-${name}`, match: text => rangesFor(text, name) }));
}
