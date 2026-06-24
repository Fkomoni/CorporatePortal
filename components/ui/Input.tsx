import React from 'react';
import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-[#131C4E]">{label}</label>}
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
          <input
            ref={ref}
            className={twMerge(clsx(
              'w-full h-10 px-3 text-sm rounded-lg border transition-colors outline-none',
              'border-[#E5E7F1] bg-white text-[#131C4E] placeholder:text-gray-400',
              'focus:border-[#F56B22] focus:ring-2 focus:ring-[#F56B22]/10',
              error && 'border-red-400 focus:border-red-400 focus:ring-red-100',
              icon && 'pl-9',
              className
            ))}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
