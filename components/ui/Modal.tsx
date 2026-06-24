'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onOpenChange, title, description, children, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={twMerge(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full bg-white rounded-xl shadow-xl p-6',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            sizeClasses[size]
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-[#131C4E]">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-gray-500 mt-1">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="p-1 rounded-lg hover:bg-[#F1F2F8] text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
