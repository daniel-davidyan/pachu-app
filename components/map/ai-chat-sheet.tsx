'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, ChevronDown, MapPin, Star, Navigation } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Restaurant[];
}

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  rating?: number;
  totalReviews?: number;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
  priceLevel?: number;
  cuisineTypes?: string[];
  source?: 'google' | 'friends' | 'own';
  googlePlaceId?: string;
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

  // Detect keyboard open/close by monitoring viewport height changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Store initial height
    initialViewportHeight.current = window.visualViewport?.height || window.innerHeight;
    
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialViewportHeight.current - currentHeight;
      
      // If viewport shrunk by more than 150px, keyboard is likely open
      if (heightDiff > 150) {
        setIsKeyboardOpen(true);
        // When keyboard opens: chat takes 40% of remaining space
        const remainingHeight = currentHeight;
        const chatHeight = remainingHeight * 0.4; // 40% for chat, 10% will be map
        setSheetHeight(Math.max(minHeight, chatHeight));
      } else {
        if (isKeyboardOpen) {
          // Keyboard closed, adjust to 50/50 split if chat was active
          if (isActive) {
            const halfScreen = (window.visualViewport?.height || window.innerHeight) * 0.5;
            setSheetHeight(halfScreen);
          }
        }
        setIsKeyboardOpen(false);
      }
    };

    // Listen to both visualViewport and window resize
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive, isKeyboardOpen]);

  // Calculate max height
  useEffect(() => {
    const updateMaxHeight = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      setMaxHeight(vh - 100);
    };
    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, []);

  // Notify parent of chat state changes
  useEffect(() => {
    if (onChatStateChange) {
      onChatStateChange(isActive);
    }
  }, [isActive, onChatStateChange]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = dragStartY.current - currentY;
      
      let newHeight = dragStartHeight.current + deltaY;
      newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      
      setSheetHeight(newHeight);
    };

    const handleEnd = () => {
      setIsDragging(false);
      
      // Snap to positions
      if (sheetHeight < 150) {
        handleClose();
      } else if (isKeyboardOpen) {
        // Keep current height when keyboard is open
        return;
      } else if (sheetHeight < 350) {
        setSheetHeight(200);
      } else {
        // Snap to 50% when keyboard is closed
        const halfScreen = (window.visualViewport?.height || window.innerHeight) * 0.5;
        setSheetHeight(halfScreen);
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
    // Start with smaller height, will adjust based on keyboard
    setSheetHeight(minHeight);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleClose = () => {
    setIsActive(false);
    setInputValue('');
    setIsKeyboardOpen(false);
    inputRef.current?.blur();
  };

  const handleRestaurantCardClick = (restaurant: Restaurant) => {
    if (onRestaurantClick && restaurant.latitude && restaurant.longitude) {
      onRestaurantClick(restaurant);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Auto-expand if needed
    if (!isActive || sheetHeight < 300) {
      setIsActive(true);
      if (!isKeyboardOpen) {
        const halfScreen = (window.visualViewport?.height || window.innerHeight) * 0.5;
        setSheetHeight(halfScreen);
      }
    }

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('/api/map-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          conversationHistory,
          location: userLocation || { lat: 32.0853, lng: 34.7818 }
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        restaurants: data.restaurants || []
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.restaurants && data.restaurants.length > 0) {
        onRestaurantsFound?.(data.restaurants);
      }

      if (data.filters) {
        onFilterChange?.(data.filters);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting. Let me help you find restaurants near you! 📍"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Restaurant icon helper
  const getRestaurantIcon = (restaurant: Restaurant): string => {
    const cuisines = restaurant.cuisineTypes || [];
    const name = restaurant.name?.toLowerCase() || '';
    const allText = [...cuisines, name].join(' ').toLowerCase();
    
    if (allText.includes('coffee') || allText.includes('cafe')) return '☕';
    if (allText.includes('pizza')) return '🍕';
    if (allText.includes('sushi') || allText.includes('japanese')) return '🍣';
    if (allText.includes('chinese')) return '🥡';
    if (allText.includes('burger')) return '🍔';
    if (allText.includes('mexican') || allText.includes('taco')) return '🌮';
    if (allText.includes('indian') || allText.includes('curry')) return '🍛';
    if (allText.includes('bakery') || allText.includes('pastry')) return '🥐';
    if (allText.includes('ice cream') || allText.includes('dessert')) return '🍨';
    if (allText.includes('bar') || allText.includes('wine')) return '🍷';
    if (allText.includes('seafood') || allText.includes('fish')) return '🦐';
    if (allText.includes('steak') || allText.includes('grill')) return '🥩';
    if (allText.includes('thai')) return '🍜';
    if (allText.includes('mediterranean') || allText.includes('greek')) return '🥙';
    if (allText.includes('italian') || allText.includes('pasta')) return '🍝';
    
    return '🍽️';
  };

  // If not active, show only floating search bar
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
        <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-full px-4 py-2 shadow-xl focus-within:border-primary transition-all hover:shadow-2xl">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (!isActive) handleActivate();
            }}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            onFocus={handleActivate}
            placeholder="Let Pachu guide you to your perfect taste..."
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 font-medium"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            style={{
              background: inputValue.trim() 
                ? 'linear-gradient(to right, #C5459C, rgba(197, 69, 156, 0.9))' 
                : '#E5E7EB'
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:shadow-lg hover:scale-105 transition-all active:scale-95 flex-shrink-0 shadow-md"
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

  // Active pane with conversation
  return (
    <div
      ref={sheetRef}
      className="fixed z-40 bg-gradient-to-b from-gray-50 to-white rounded-t-3xl shadow-2xl border-t border-gray-200 transition-all duration-300 ease-out overflow-hidden"
      style={{ 
        bottom: 0,
        left: 0,
        right: 0,
        height: sheetHeight,
        maxHeight: maxHeight,
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
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Pachu Assistant</h2>
              {matchedCount > 0 && (
                <p className="text-xs text-gray-500">{matchedCount} places found</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">Discover Your Perfect Taste</h3>
              <p className="text-xs text-gray-500 px-4">Tell me what you&apos;re craving and I&apos;ll find the perfect spot for you...</p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id}>
              <div
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              </div>
              
              {/* Restaurant Suggestion Cards */}
              {message.role === 'assistant' && message.restaurants && message.restaurants.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 px-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Suggested For You</p>
                  </div>
                  {message.restaurants.map((restaurant) => (
                    <div
                      key={restaurant.id}
                      onClick={() => handleRestaurantCardClick(restaurant)}
                      className="bg-gradient-to-br from-white to-primary/5 rounded-2xl p-3 border-2 border-primary/20 shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <div className="flex gap-3">
                        {/* Icon/Image */}
                        <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
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
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">{restaurant.name}</h4>
                          
                          {/* Rating */}
                          {restaurant.rating && (
                            <div className="flex items-center gap-1 mb-1">
                              <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-semibold text-gray-700">{restaurant.rating.toFixed(1)}</span>
                              {restaurant.totalReviews && (
                                <span className="text-xs text-gray-400">({restaurant.totalReviews})</span>
                              )}
                              {restaurant.priceLevel && (
                                <span className="text-xs text-gray-600 ml-1">{'₪'.repeat(restaurant.priceLevel)}</span>
                              )}
                            </div>
                          )}
                          
                          {/* Address */}
                          {restaurant.address && (
                            <p className="text-xs text-gray-500 truncate">{restaurant.address}</p>
                          )}
                          
                          {/* Cuisines */}
                          {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {restaurant.cuisineTypes.slice(0, 2).map((cuisine, idx) => (
                                <span 
                                  key={idx}
                                  className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium"
                                >
                                  {cuisine.replace(/_/g, ' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Arrow */}
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <Navigation className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-full px-4 py-2 focus-within:border-primary transition-colors shadow-md">
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
              style={{
                background: inputValue.trim() 
                  ? 'linear-gradient(to right, #C5459C, rgba(197, 69, 156, 0.9))' 
                  : '#E5E7EB'
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all active:scale-95 flex-shrink-0"
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
