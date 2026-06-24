import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'text-white shadow-sm hover:opacity-90 active:opacity-80 disabled:opacity-50',
  secondary: 'bg-[#131C4E] text-white hover:bg-[#1F2960] active:bg-[#0d1338] disabled:opacity-50',
  outline: 'bg-transparent text-[#131C4E] border border-[#E5E7F1] hover:bg-[#F1F2F8] active:bg-[#E5E7F1] disabled:opacity-50',
  ghost: 'bg-transparent text-[#131C4E] hover:bg-[#F1F2F8] active:bg-[#E5E7F1] disabled:opacity-50',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 disabled:opacity-50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-md gap-1.5',
  md: 'px-4 py-2 text-sm font-medium rounded-lg gap-2',
  lg: 'px-6 py-3 text-base font-semibold rounded-xl gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', children, className, isLoading, style, ...props }, ref) => {
    const isPrimary = variant === 'primary';
    return (
      <button
        ref={ref}
        style={isPrimary ? { background: 'linear-gradient(135deg, #F56B22 0%, #FFB54B 100%)', ...style } : style}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center transition-all duration-150 cursor-pointer',
            variantStyles[variant],
            sizeStyles[size],
            className
          )
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
