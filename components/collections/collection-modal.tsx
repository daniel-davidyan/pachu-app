'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (collection: { id: string; name: string }) => void;
  editingCollection?: {
    id: string;
    name: string;
    cover_image_url?: string | null;
  } | null;
}

export function CollectionModal({
  isOpen,
  onClose,
  onSuccess,
  editingCollection,
}: CollectionModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingCollection;

  useEffect(() => {
    if (isOpen) {
      setName(editingCollection?.name || '');
      // Focus input after animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, editingCollection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Please enter a collection name', 'error');
      return;
    }

    setSaving(true);

    try {
      const url = isEditing 
        ? `/api/collections/${editingCollection.id}` 
        : '/api/collections';
      
      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast(
          isEditing ? 'Collection updated' : 'Collection created',
          'success'
        );
        onSuccess(data.collection);
        onClose();
      } else {
        showToast(data.error || 'Failed to save collection', 'error');
      }
    } catch (error) {
      console.error('Error saving collection:', error);
      showToast('Failed to save collection', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Collection' : 'New Collection'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Collection Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Date Night Spots"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                maxLength={50}
              />
              <p className="text-xs text-gray-400 mt-2">
                {name.length}/50 characters
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex-1 py-3 px-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : isEditing ? (
                  'Save Changes'
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
