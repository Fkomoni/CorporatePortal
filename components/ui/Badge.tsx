import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'orange' | 'navy';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  error: 'bg-red-50 text-red-700 border border-red-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
  orange: 'bg-orange-50 text-orange-600 border border-orange-200',
  navy: 'bg-[#E5E7F1] text-[#131C4E] border border-[#C8CCDF]',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          variantStyles[variant],
          className
        )
      )}
    >
      {children}
    </span>
  );
}
