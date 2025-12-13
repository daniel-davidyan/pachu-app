'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, ChevronDown, MapPin, Star, Navigation, Plus } from 'lucide-react';

// Restaurant type - matches mapbox component
interface Restaurant {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  totalReviews: number;
  photoUrl?: string;
  priceLevel?: number;
  cuisineTypes?: string[];
  source: 'google' | 'friends' | 'own';
  googlePlaceId?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Restaurant[];
}

interface AIChatSheetProps {
  onFilterChange?: (filters: RestaurantFilters) => void;
  onRestaurantsFound?: (restaurants: Restaurant[]) => void;
  matchedCount?: number;
  userLocation?: { lat: number; lng: number } | null;
  onChatStateChange?: (isActive: boolean) => void;
  onRestaurantClick?: (restaurant: Restaurant) => void;
}

export interface RestaurantFilters {
  query: string;
  priceLevel?: number[];
  cuisineTypes?: string[];
  rating?: number;
  petFriendly?: boolean;
  romantic?: boolean;
  outdoor?: boolean;
}

const STORAGE_KEY = 'pachu_chat_v8';

// Helper function to get restaurant icon
function getRestaurantIcon(restaurant: Restaurant): string {
  const text = [
    ...(restaurant.cuisineTypes || []),
    restaurant.name
  ].join(' ').toLowerCase();
  
  if (text.includes('coffee') || text.includes('cafe')) return '☕';
  if (text.includes('pizza')) return '🍕';
  if (text.includes('sushi') || text.includes('japanese')) return '🍣';
  if (text.includes('chinese')) return '🥡';
  if (text.includes('burger')) return '🍔';
  if (text.includes('mexican') || text.includes('taco')) return '🌮';
  if (text.includes('indian')) return '🍛';
  if (text.includes('bakery')) return '🥐';
  if (text.includes('ice cream')) return '🍨';
  if (text.includes('bar') || text.includes('wine')) return '🍷';
  if (text.includes('seafood')) return '🦐';
  if (text.includes('steak') || text.includes('grill')) return '🥩';
  if (text.includes('thai')) return '🍜';
  if (text.includes('mediterranean')) return '🥙';
  if (text.includes('italian')) return '🍝';
  return '🍽️';
}

export function AIChatSheet({ 
  onFilterChange, 
  onRestaurantsFound, 
  matchedCount = 0, 
  userLocation, 
  onChatStateChange,
  onRestaurantClick 
}: AIChatSheetProps) {
  const [isActive, setIsActive] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [maxHeight, setMaxHeight] = useState(700);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialViewportHeight = useRef(0);

  const minHeight = 200;

  // Load messages from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch {
        // Ignore
      }
    }
  }, [messages]);

  const handleNewConversation = () => {
    setMessages([]);
    setInputValue('');
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Keyboard detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    initialViewportHeight.current = window.visualViewport?.height || window.innerHeight;
    
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialViewportHeight.current - currentHeight;
      
      if (heightDiff > 150) {
        setIsKeyboardOpen(true);
        setSheetHeight(Math.max(minHeight, currentHeight * 0.4));
      } else {
        if (isKeyboardOpen && isActive) {
          setSheetHeight((window.visualViewport?.height || window.innerHeight) * 0.5);
        }
        setIsKeyboardOpen(false);
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive, isKeyboardOpen]);

  // Max height
  useEffect(() => {
    const update = () => {
      setMaxHeight((window.visualViewport?.height || window.innerHeight) * 0.8);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Notify parent
  useEffect(() => {
    onChatStateChange?.(isActive);
  }, [isActive, onChatStateChange]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Drag handling
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = dragStartY.current - currentY;
      const newHeight = Math.max(minHeight, Math.min(maxHeight, dragStartHeight.current + deltaY));
      setSheetHeight(newHeight);
    };

    const handleEnd = () => {
      setIsDragging(false);
      if (sheetHeight < 150) {
        handleClose();
      } else if (!isKeyboardOpen) {
        if (sheetHeight < 350) {
          setSheetHeight(minHeight);
        } else if (sheetHeight < 600) {
          setSheetHeight((window.visualViewport?.height || window.innerHeight) * 0.5);
        } else {
          setSheetHeight(maxHeight);
        }
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, sheetHeight, maxHeight, isKeyboardOpen]);

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    dragStartHeight.current = sheetHeight;
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    e.preventDefault();
  };

  const handleActivate = () => {
    setIsActive(true);
    setSheetHeight(minHeight);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClose = () => {
    setIsActive(false);
    setIsKeyboardOpen(false);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: String(Date.now()),
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    if (!isActive || sheetHeight < 300) {
      setIsActive(true);
      if (!isKeyboardOpen) {
        setSheetHeight((window.visualViewport?.height || window.innerHeight) * 0.5);
      }
    }

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch(`/api/map-chat?t=${Date.now()}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          message: currentInput,
          conversationHistory,
          location: userLocation || { lat: 32.0853, lng: 34.7818 }
        }),
        cache: 'no-store'
      });

      const rawText = await res.text();
      let data: Record<string, unknown>;
      
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('JSON parse failed');
      }

      if (data.error) {
        throw new Error(String(data.error));
      }

      // Debug: Check what keys exist in the response
      const responseKeys = Object.keys(data).join(', ');
      const hasRestaurantsKey = 'restaurants' in data;
      const restaurantsType = data.restaurants ? (Array.isArray(data.restaurants) ? `array(${(data.restaurants as unknown[]).length})` : typeof data.restaurants) : 'undefined';

      // Parse restaurants with explicit validation
      const parsedRestaurants: Restaurant[] = [];
      
      if (data.restaurants && Array.isArray(data.restaurants)) {
        for (let i = 0; i < data.restaurants.length; i++) {
          const r = data.restaurants[i];
          if (r && typeof r === 'object' && r.id && r.name) {
            parsedRestaurants.push({
              id: String(r.id),
              name: String(r.name),
              address: String(r.address || ''),
              latitude: Number(r.latitude) || 0,
              longitude: Number(r.longitude) || 0,
              rating: Number(r.rating) || 0,
              totalReviews: Number(r.totalReviews) || 0,
              photoUrl: r.photoUrl ? String(r.photoUrl) : undefined,
              priceLevel: r.priceLevel ? Number(r.priceLevel) : undefined,
              cuisineTypes: Array.isArray(r.cuisineTypes) ? r.cuisineTypes.map(String) : [],
              source: (r.source === 'friends' || r.source === 'own') ? r.source : 'google',
              googlePlaceId: r.googlePlaceId ? String(r.googlePlaceId) : undefined
            });
          }
        }
      }

      // Debug: Include full diagnostic info in message
      let messageContent = String(data.message || '');
      messageContent += `\n\n[API: keys=${responseKeys}, hasR=${hasRestaurantsKey}, type=${restaurantsType}, parsed=${parsedRestaurants.length}]`;

      const assistantMessage: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: messageContent,
        restaurants: parsedRestaurants.length > 0 ? parsedRestaurants : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (parsedRestaurants.length > 0) {
        onRestaurantsFound?.(parsedRestaurants);
      }

      if (data.filters && typeof data.filters === 'object') {
        onFilterChange?.(data.filters as RestaurantFilters);
      }

    } catch {
      const errorMessage: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: "I'm having trouble connecting. Please try again! 📍"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Inactive state - just search bar
  if (!isActive) {
    return (
      <div 
        className="fixed z-40"
        style={{
          bottom: 'calc(4.75rem + env(safe-area-inset-bottom))',
          left: 'max(1rem, env(safe-area-inset-left))',
          right: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-full px-4 py-2 shadow-xl">
          <Sparkles className="w-4 h-4 text-pink-500 flex-shrink-0" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (!isActive) handleActivate();
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            onFocus={handleActivate}
            placeholder="Let Pachu find your taste..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 font-medium"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="w-8 h-8 flex items-center justify-center rounded-full shadow-md flex-shrink-0"
            style={{
              background: inputValue.trim() 
                ? 'linear-gradient(to right, #C5459C, #E85CA8)' 
                : '#E5E7EB'
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send 
                className="w-4 h-4 stroke-[2.5]"
                style={{ color: inputValue.trim() ? '#FFFFFF' : '#6B7280' }}
              />
            )}
          </button>
        </div>
      </div>
    );
  }

  // Active state - full chat
  return (
    <div
      ref={sheetRef}
      className="fixed z-40 bg-gradient-to-b from-gray-50 to-white rounded-t-3xl shadow-2xl border-t border-gray-200 overflow-hidden"
      style={{ 
        bottom: 0,
        left: 0,
        right: 0,
        height: sheetHeight,
        maxHeight: maxHeight,
        transition: isDragging ? 'none' : 'height 0.3s ease-out'
      }}
    >
      {/* Drag Handle */}
      <div
        className="flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none bg-white/50"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
      </div>

      {/* Content */}
      <div className="flex flex-col h-[calc(100%-32px)] px-4 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-pink-500 to-pink-400 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Pachu Assistant</h2>
              {matchedCount > 0 && (
                <p className="text-xs text-gray-500">{matchedCount} places found</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleNewConversation}
                className="w-8 h-8 flex items-center justify-center bg-pink-100 hover:bg-pink-200 rounded-full"
              >
                <Plus className="w-4 h-4 text-pink-500" />
              </button>
            )}
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full"
            >
              <ChevronDown className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-pink-500" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">Discover Your Perfect Taste</h3>
              <p className="text-xs text-gray-500 px-4">Tell me what you&apos;re craving...</p>
            </div>
          )}

          {messages.map((message) => {
            const restaurants = message.restaurants;
            const hasRestaurants = restaurants && Array.isArray(restaurants) && restaurants.length > 0;
            
            return (
              <div key={message.id}>
                {/* Message bubble */}
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-pink-500 text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  </div>
                </div>
                
                {/* Restaurant cards - INLINE RENDERING */}
                {message.role === 'assistant' && hasRestaurants && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 px-2">
                      <MapPin className="w-4 h-4 text-pink-500" />
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Suggested For You ({restaurants.length})
                      </p>
                    </div>
                    
                    {/* Debug: Show restaurant names as text (always visible) */}
                    <div className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                      📍 {restaurants.map(r => r.name).join(' | ')}
                    </div>
                    
                    {restaurants.map((restaurant, idx) => (
                      <div
                        key={restaurant.id || `r-${idx}`}
                        onClick={() => onRestaurantClick?.(restaurant)}
                        className="bg-gradient-to-br from-white to-pink-50 rounded-2xl p-3 border-2 border-pink-200 shadow-md active:scale-98 cursor-pointer"
                      >
                        <div className="flex gap-3">
                          <div className="w-16 h-16 flex-shrink-0 rounded-xl p-0.5 bg-pink-500">
                            <div className="w-full h-full rounded-xl overflow-hidden bg-pink-50 flex items-center justify-center">
                              {restaurant.photoUrl ? (
                                <img 
                                  src={restaurant.photoUrl} 
                                  alt={restaurant.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-3xl">{getRestaurantIcon(restaurant)}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">
                              {restaurant.name}
                            </h4>
                            
                            <div className="flex items-center gap-1 mb-1">
                              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-semibold text-gray-700">
                                {restaurant.rating.toFixed(1)}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({restaurant.totalReviews})
                              </span>
                              {restaurant.priceLevel && restaurant.priceLevel > 0 && (
                                <span className="text-xs text-gray-600 ml-1">
                                  {'₪'.repeat(restaurant.priceLevel)}
                                </span>
                              )}
                            </div>
                            
                            <p className="text-xs text-gray-500 truncate">{restaurant.address}</p>
                          </div>
                          
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center">
                              <Navigation className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <Loader2 className="w-5 h-5 animate-spin text-pink-500" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-full px-4 py-2 focus-within:border-pink-500 shadow-md">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="What are you craving?"
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="w-8 h-8 flex items-center justify-center rounded-full shadow-lg flex-shrink-0"
              style={{
                background: inputValue.trim() 
                  ? 'linear-gradient(to right, #C5459C, #E85CA8)' 
                  : '#E5E7EB'
              }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send 
                  className="w-4 h-4 stroke-[2.5]"
                  style={{ color: inputValue.trim() ? '#FFFFFF' : '#6B7280' }}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
