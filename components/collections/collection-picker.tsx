'use client';

import { useState, useEffect } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Check, Plus, Bookmark, Loader2, FolderPlus } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

interface Collection {
  id: string;
  name: string;
  cover_image_url: string | null;
  items_count: number;
  preview_images: string[];
}

interface CollectionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: {
    id?: string;
    googlePlaceId?: string;
    name: string;
    address?: string;
    imageUrl?: string;
  };
  onSaved?: (collectionId: string | null) => void;
  onCreateNew?: () => void;
}

export function CollectionPicker({
  isOpen,
  onClose,
  restaurant,
  onSaved,
  onCreateNew,
}: CollectionPickerProps) {
  const { showToast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
      checkCurrentCollection();
    }
  }, [isOpen]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/collections');
      const data = await response.json();
      
      if (data.collections) {
        setCollections(data.collections);
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      showToast('Failed to load collections', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentCollection = async () => {
    // Check if restaurant is already saved and in which collection
    try {
      const response = await fetch('/api/wishlist');
      const data = await response.json();
      
      if (data.wishlist) {
        const item = data.wishlist.find((w: any) => {
          const itemGooglePlaceId = w.restaurants?.google_place_id;
          const itemId = w.restaurants?.id;
          
          // Match by google_place_id first
          if (restaurant.googlePlaceId && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurant.googlePlaceId;
          }
          // Then try matching by id
          if (restaurant.id && itemId) {
            return itemId === restaurant.id;
          }
          // Also try matching restaurant.id with google_place_id
          if (restaurant.id && itemGooglePlaceId) {
            return itemGooglePlaceId === restaurant.id;
          }
          return false;
        });
        
        if (item) {
          setCurrentCollectionId(item.collection_id);
        } else {
          setCurrentCollectionId(null);
        }
      }
    } catch (error) {
      console.error('Error checking current collection:', error);
    }
  };

  const handleSaveToCollection = async (collectionId: string | null) => {
    setSaving(collectionId || 'all');
    
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          googlePlaceId: restaurant.googlePlaceId,
          name: restaurant.name,
          address: restaurant.address,
          imageUrl: restaurant.imageUrl,
          collectionId: collectionId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentCollectionId(collectionId);
        showToast(
          collectionId 
            ? `Saved to ${collections.find(c => c.id === collectionId)?.name || 'collection'}` 
            : 'Saved to All Saved',
          'success'
        );
        onSaved?.(collectionId);
        onClose();
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch (error) {
      console.error('Error saving to collection:', error);
      showToast('Failed to save', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleCreateNew = () => {
    onClose();
    onCreateNew?.();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Save to..."
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* All Saved Option */}
          <button
            onClick={() => handleSaveToCollection(null)}
            disabled={saving !== null}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-colors ${
              currentCollectionId === null
                ? 'bg-primary/10 border-2 border-primary'
                : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
            }`}
          >
            <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bookmark className="w-6 h-6 text-gray-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-900">All Saved</p>
              <p className="text-sm text-gray-500">Default collection</p>
            </div>
            {saving === 'all' ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : currentCollectionId === null ? (
              <Check className="w-5 h-5 text-primary" />
            ) : null}
          </button>

          {/* Collections List */}
          {collections.map((collection) => (
            <button
              key={collection.id}
              onClick={() => handleSaveToCollection(collection.id)}
              disabled={saving !== null}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-colors ${
                currentCollectionId === collection.id
                  ? 'bg-primary/10 border-2 border-primary'
                  : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
              }`}
            >
              {/* Collection Preview */}
              <div className="w-14 h-14 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                {collection.cover_image_url || collection.preview_images?.[0] ? (
                  <img
                    src={collection.cover_image_url || collection.preview_images[0]}
                    alt={collection.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <Bookmark className="w-6 h-6 text-primary/50" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-900">{collection.name}</p>
                <p className="text-sm text-gray-500">
                  {collection.items_count} {collection.items_count === 1 ? 'place' : 'places'}
                </p>
              </div>
              
              {saving === collection.id ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : currentCollectionId === collection.id ? (
                <Check className="w-5 h-5 text-primary" />
              ) : null}
            </button>
          ))}

          {/* Create New Collection Button */}
          <button
            onClick={handleCreateNew}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <div className="w-14 h-14 bg-white border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center flex-shrink-0">
              <FolderPlus className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-gray-700">Create New Collection</p>
              <p className="text-sm text-gray-500">Organize your saved places</p>
            </div>
            <Plus className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
