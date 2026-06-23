import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-[#131C4E]">{label}</label>}
        <div className="relative">
          <select
            ref={ref}
            className={twMerge(clsx(
              'w-full h-10 px-3 pr-8 text-sm rounded-lg border transition-colors outline-none appearance-none',
              'border-[#E5E7F1] bg-white text-[#131C4E]',
              'focus:border-[#F56B22] focus:ring-2 focus:ring-[#F56B22]/10',
              error && 'border-red-400',
              className
            ))}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
