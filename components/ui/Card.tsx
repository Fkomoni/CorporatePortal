import { twMerge } from 'tailwind-merge';
import { clsx } from 'clsx';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ title, subtitle, action, children, className, noPadding }: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white rounded-xl border border-[#E5E7F1] shadow-sm',
          className
        )
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between px-6 pt-5 pb-0">
          <div>
            {title && <h3 className="text-base font-semibold text-[#131C4E]">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="ml-4 flex-shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>{children}</div>
    </div>
  );
}
