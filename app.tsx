import { useState } from 'react';
import { definePluginApp, useComposer, useRpc, useSettings } from '@get-bb/plugin-sdk/app';
import { toast } from 'sonner';
import type { rpcContract } from './server';
import { createPaintEffects, paintCss } from './paint';

function ToggleHighlighting() {
  const { values, isLoading } = useSettings();
  const rpc = useRpc<typeof rpcContract>();
  const [pending, setPending] = useState(false);
  const enabled = values?.enabled !== false;
  const label = `Turn ${enabled ? 'off' : 'on'} Markdown highlighting`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      disabled={pending || isLoading}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      onMouseDown={event => event.preventDefault()}
      onClick={async () => {
        setPending(true);
        try { await rpc.call('setMode', { mode: 'toggle' }); }
        catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save Markdown highlighting.'); }
        finally { setPending(false); }
      }}
    >
      <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="1" y="1" width="22" height="16" rx="2" />
        <path d="M5 13V5l3 4 3-4v8M15 10l3 3 3-3M18 5v8" />
      </svg>
    </button>
  );
}

function PaintStyles() {
  const { values, isLoading } = useSettings();
  const composer = useComposer();
  return <>
    {/* Removing only our stylesheet repaints without an editor transaction. */}
    <style>{!isLoading && values?.enabled !== false ? paintCss : ''}</style>
    {composer.layout === 'compact' ? <div className="flex justify-end"><ToggleHighlighting /></div> : null}
  </>;
}

export default definePluginApp(app => {
  app.composer.customize({
    id: 'markdown-paint',
    richText: { effects: createPaintEffects() },
    actions: [{ id: 'toggle', component: ToggleHighlighting }],
    banners: [{ id: 'paint-styles', chrome: 'bare', component: PaintStyles }],
  });
});
