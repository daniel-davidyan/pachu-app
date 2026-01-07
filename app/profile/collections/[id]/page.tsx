'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { ArrowLeft, Loader2, Bookmark, MoreVertical, Edit2, Trash2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { useUser } from '@/hooks/use-user';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { CollectionModal } from '@/components/collections/collection-modal';

interface WishlistItem {
  id: string;
  created_at: string;
  restaurant_id: string;
  restaurants: {
    id: string;
    google_place_id: string;
    name: string;
    address: string;
    image_url?: string;
  };
}

interface Collection {
  id: string;
  name: string;
  cover_image_url: string | null;
  items_count: number;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useUser();
  
  const collectionId = params.id as string;
  const isAllSaved = collectionId === 'all';
  
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [removingItem, setRemovingItem] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCollectionData();
    }
  }, [user, collectionId]);

  const fetchCollectionData = async () => {
    setLoading(true);
    try {
      if (isAllSaved) {
        // Fetch all wishlist items
        const response = await fetch('/api/wishlist');
        const data = await response.json();
        
        if (data.wishlist) {
          setItems(data.wishlist);
          setCollection({
            id: 'all',
            name: 'All Saved',
            cover_image_url: null,
            items_count: data.count || data.wishlist.length,
          });
        }
      } else {
        // Fetch specific collection
        const response = await fetch(`/api/collections/${collectionId}`);
        const data = await response.json();
        
        if (response.ok) {
          setCollection(data.collection);
          setItems(data.items || []);
        } else {
          showToast('Collection not found', 'error');
          router.push('/profile');
        }
      }
    } catch (error) {
      console.error('Error fetching collection:', error);
      showToast('Failed to load collection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromCollection = async (restaurantId: string) => {
    setRemovingItem(restaurantId);
    try {
      if (isAllSaved) {
        // Remove from wishlist entirely
        const response = await fetch(`/api/wishlist?restaurantId=${restaurantId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          setItems(prev => prev.filter(item => item.restaurants.id !== restaurantId));
          showToast('Removed from saved', 'success');
        }
      } else {
        // Move to "All Saved" (remove from collection)
        const response = await fetch('/api/wishlist', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId,
            collectionId: null, // Move to All Saved
          }),
        });
        
        if (response.ok) {
          setItems(prev => prev.filter(item => item.restaurants.id !== restaurantId));
          showToast('Moved to All Saved', 'success');
        }
      }
    } catch (error) {
      console.error('Error removing item:', error);
      showToast('Failed to remove item', 'error');
    } finally {
      setRemovingItem(null);
    }
  };

  const handleDeleteCollection = async () => {
    try {
      const response = await fetch(`/api/collections/${collectionId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        showToast('Collection deleted', 'success');
        router.push('/profile');
      } else {
        showToast('Failed to delete collection', 'error');
      }
    } catch (error) {
      console.error('Error deleting collection:', error);
      showToast('Failed to delete collection', 'error');
    }
  };

  const handleCollectionUpdated = (updatedCollection: { id: string; name: string }) => {
    setCollection(prev => prev ? { ...prev, name: updatedCollection.name } : null);
    showToast('Collection updated', 'success');
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </MainLayout>
    );
  }

  if (!collection) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <p className="text-gray-500 mb-4">Collection not found</p>
          <button 
            onClick={() => router.back()}
            className="text-primary font-semibold"
          >
            Go Back
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="pb-24 bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 h-14">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center -ml-2"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="flex-1 text-center font-semibold text-gray-900">
              {collection.name}
            </h1>
            {!isAllSaved && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-10 h-10 flex items-center justify-center -mr-2"
                >
                  <MoreVertical className="w-5 h-5 text-gray-900" />
                </button>
                
                {showMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-12 z-20 bg-white rounded-xl shadow-xl border border-gray-200 py-1 w-40">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowEditModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Name
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Collection
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {isAllSaved && <div className="w-10" />}
          </div>
        </div>

        {/* Collection Info */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-500">
            {items.length} {items.length === 1 ? 'place' : 'places'}
          </p>
        </div>

        {/* Items Grid */}
        {items.length > 0 ? (
          <div className="grid grid-cols-3 gap-[1px] bg-gray-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="relative aspect-square bg-gray-200 overflow-hidden group"
              >
                <Link
                  href={`/restaurant/${item.restaurants?.google_place_id || item.restaurants?.id}`}
                  className="block w-full h-full"
                >
                  {item.restaurants?.image_url ? (
                    <img
                      src={item.restaurants.image_url}
                      alt={item.restaurants.name}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-2xl">🍽️</span>
                    </div>
                  )}
                  
                  {/* Restaurant Name Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-2">
                    <p className="text-white text-xs font-medium line-clamp-2 leading-tight">
                      {item.restaurants?.name || 'Restaurant'}
                    </p>
                  </div>
                </Link>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveFromCollection(item.restaurants.id)}
                  disabled={removingItem === item.restaurants.id}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                >
                  {removingItem === item.restaurants.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5 text-white fill-white" />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-900 font-semibold">No places saved yet</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                {isAllSaved 
                  ? 'Save restaurants to see them here'
                  : 'Add restaurants to this collection'}
              </p>
              <Link 
                href="/map" 
                className="inline-block bg-primary text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Explore Restaurants
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Edit Collection Modal */}
      {!isAllSaved && (
        <CollectionModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleCollectionUpdated}
          editingCollection={collection}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteCollection}
        title="Delete this collection?"
        message="The restaurants in this collection will be moved to All Saved."
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </MainLayout>
  );
}
