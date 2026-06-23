'use client';

import { twMerge } from 'tailwind-merge';

interface Tab {
  id: string;
  label: string;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={twMerge('flex border-b border-[#E5E7F1]', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={twMerge(
            'relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2',
            activeTab === tab.id
              ? 'text-[#F56B22] border-b-2 border-[#F56B22]'
              : 'text-gray-500 hover:text-[#131C4E] border-b-2 border-transparent'
          )}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span className={twMerge(
              'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-semibold',
              activeTab === tab.id ? 'bg-[#F56B22] text-white' : 'bg-[#E5E7F1] text-[#3A4382]'
            )}>{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
