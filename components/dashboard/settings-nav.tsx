"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface SettingsSection {
  id: string;
  label: string;
}

/**
 * Anchor nav for the settings column. The active pill is driven by what is
 * actually on screen rather than by click state, so deep links and scrolling
 * both keep it honest.
 */
export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id);

  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Bias the band towards the top of the viewport so the heading you are
      // reading wins, not the one still below the fold.
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Settings sections"
      className="-mx-1 flex gap-0.5 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
    >
      {sections.map((section) => {
        const active = section.id === activeId;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex-none whitespace-nowrap rounded-[9px] px-3 py-2.5 text-[13px] transition-colors",
              active
                ? "bg-secondary font-semibold text-foreground"
                : "font-medium text-muted-foreground hover:text-foreground"
            )}
          >
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
