'use client';

import { X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'bg-red-600 hover:bg-red-700',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-lg max-w-xs w-full overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>

        {/* Content */}
        <div className="p-5 pt-6">
          {/* Title */}
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            {message}
          </p>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors text-sm"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl transition-colors text-sm ${confirmButtonClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

