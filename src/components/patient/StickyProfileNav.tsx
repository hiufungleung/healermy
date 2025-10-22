'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/library/shadcn-utils';

export interface ProfileSection {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface StickyProfileNavProps {
  sections: ProfileSection[];
  activeSection?: string;
  onSectionClick?: (sectionId: string) => void;
}

export const StickyProfileNav: React.FC<StickyProfileNavProps> = ({
  sections,
  activeSection: controlledActiveSection,
  onSectionClick,
}) => {
  const [activeSection, setActiveSection] = useState<string>(controlledActiveSection || sections[0]?.id);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Check if the nav should be sticky
      setIsSticky(window.scrollY > 200);

      // Find the currently visible section
      if (!controlledActiveSection) {
        for (const section of sections) {
          const element = document.getElementById(section.id);
          if (element) {
            const rect = element.getBoundingClientRect();
            // Check if section is in viewport
            if (rect.top <= 100 && rect.bottom >= 100) {
              setActiveSection(section.id);
              break;
            }
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections, controlledActiveSection]);

  // Use controlled active section if provided
  useEffect(() => {
    if (controlledActiveSection) {
      setActiveSection(controlledActiveSection);
    }
  }, [controlledActiveSection]);

  const handleSectionClick = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 80; // Account for sticky nav height
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }

    setActiveSection(sectionId);
    onSectionClick?.(sectionId);
  };

  return (
    <nav
      className={cn(
        'z-30 mb-6 transition-shadow',
        isSticky ? 'sticky top-0 border-b border-gray-200 bg-white shadow-sm' : 'relative border-b border-gray-100 bg-white'
      )}
      role="navigation"
      aria-label="Profile sections"
    >
      <div className="mx-auto max-w-8xl">
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
          {sections.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0',
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
                )}
                aria-current={isActive ? 'true' : 'false'}
              >
                {section.icon && (
                  <span className={cn('h-5 w-5', isActive ? 'text-white' : 'text-gray-400')}>
                    {section.icon}
                  </span>
                )}
                {section.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
