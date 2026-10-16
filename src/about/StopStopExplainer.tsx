/**
 * @fileoverview Stop Stop explainer (/aboutstopstop): a page about Jacked
 * Apps' Stop Stop safety app, for invited readers only.
 *
 * Unlisted on purpose: no link to it anywhere, gated off production by
 * NonProdGate (see NavRoutes), and marked noindex so search engines skip it.
 * Reachable only on staging/dev by typing the full address. The staging
 * "BETA PREVIEW" banner is hidden here: it's meant for Rackem testers.
 *
 * Content lives in stopStopContent.ts; this file only lays it out.
 */
import { Fragment, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useHideEnvBanner } from '@/config/envBannerVisibility';
import { STOP_STOP_SECTIONS, type ExplainerBlock } from './stopStopContent';

/** Renders `**bold**` spans inside a line of text. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: ExplainerBlock }) {
  if (block.type === 'text') {
    return (
      <p className="text-foreground leading-relaxed">
        <RichText text={block.text} />
      </p>
    );
  }
  return (
    <ul className="space-y-2 text-foreground">
      {block.items.map((item) => (
        <li key={item} className="flex items-start">
          <span className="mr-2">•</span>
          <span>
            <RichText text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Asks search engines not to index this page while it is open. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
}

export const StopStopExplainer: React.FC = () => {
  useNoIndex();
  useHideEnvBanner();
  return (
    <div>
      <PageHeader backTo="/" backLabel="Home" title="Stop Stop" subtitle="A free safety app from Jacked Apps" />
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {STOP_STOP_SECTIONS.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </section>
        ))}
        <p className="text-muted-foreground text-sm">
          Free and open source, and it collects no data about its users. Our server keeps only the
          locked recordings and their receipts, which it can’t open.
        </p>
      </div>
    </div>
  );
};
