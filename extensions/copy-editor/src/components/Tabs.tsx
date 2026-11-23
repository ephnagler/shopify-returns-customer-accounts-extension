// Tabs: one card above the page content,
// the current tab grey (secondary), the others plain (tertiary). The card holds
// only the tabs; notes and callouts go below it, never inside.

/**
 * Wrap a page's content in one stack. s-page lays out its direct children
 * itself and moved loose banners below the sections; inside one stack the
 * order is the order written.
 */
export function PageStack({children}: {children?: preact.ComponentChildren}) {
  return <s-stack gap="base">{children}</s-stack>;
}

export interface Tab<K extends string> {
  key: K;
  title: string;
}

export function Tabs<K extends string>({
  heading,
  tabs,
  current,
  onSelect,
}: {
  /** Page heading, shown above the tab card. The largest heading the admin renders today. */
  heading: string;
  tabs: Tab<K>[];
  current: K;
  // NoInfer: K comes from tabs and current, so a useState setter fits.
  onSelect: (key: NoInfer<K>) => void;
}) {
  return (
    <s-section heading={heading} padding="base">
      <s-stack direction="inline" gap="none">
        {tabs.map((tab) => (
          <s-button
            key={tab.key}
            variant={tab.key === current ? 'secondary' : 'tertiary'}
            onClick={() => onSelect(tab.key)}
          >
            {tab.title}
          </s-button>
        ))}
      </s-stack>
    </s-section>
  );
}
