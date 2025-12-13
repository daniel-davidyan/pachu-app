'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, ChevronDown, MapPin, Star, Navigation, Plus } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Restaurant[];
}

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

const STORAGE_KEY = 'pachu_chat_messages';

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

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setMessages(parsed);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving chat history:', error);
      }
    }
  }, [messages]);

  // Clear conversation and start fresh
  const handleNewConversation = () => {
    setMessages([]);
    setInputValue('');
    localStorage.removeItem(STORAGE_KEY);
    // Auto-focus input for new conversation
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Detect keyboard open/close by monitoring viewport height changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    initialViewportHeight.current = window.visualViewport?.height || window.innerHeight;
    
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialViewportHeight.current - currentHeight;
      
      if (heightDiff > 150) {
        setIsKeyboardOpen(true);
        const remainingHeight = currentHeight;
        const chatHeight = remainingHeight * 0.4;
        setSheetHeight(Math.max(minHeight, chatHeight));
      } else {
        if (isKeyboardOpen) {
          if (isActive) {
            const halfScreen = (window.visualViewport?.height || window.innerHeight) * 0.5;
            setSheetHeight(halfScreen);
          }
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

  // Calculate max height (80% of screen)
  useEffect(() => {
    const updateMaxHeight = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      setMaxHeight(vh * 0.8); // Allow up to 80% of screen
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
      
      if (sheetHeight < 150) {
        handleClose();
      } else if (isKeyboardOpen) {
        return;
      } else if (sheetHeight < 350) {
        setSheetHeight(minHeight);
      } else if (sheetHeight < 600) {
        const halfScreen = (window.visualViewport?.height || window.innerHeight) * 0.5;
        setSheetHeight(halfScreen);
      } else {
        // Snap to 80% when dragged high
        setSheetHeight(maxHeight);
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
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleClose = () => {
    setIsActive(false);
    setIsKeyboardOpen(false);
    // Don't blur input - let user close keyboard manually
  };

  const handleRestaurantCardClick = (restaurant: Restaurant) => {
    if (onRestaurantClick) {
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

    // DON'T blur the input - keep keyboard open
    // inputRef.current?.blur(); // REMOVED

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

      console.log('API Response:', {
        hasRestaurants: !!data.restaurants,
        restaurantCount: data.restaurants?.length || 0,
        restaurants: data.restaurants
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        restaurants: data.restaurants || []
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.restaurants && data.restaurants.length > 0) {
        console.log(`Displaying ${data.restaurants.length} restaurant cards in chat`);
        onRestaurantsFound?.(data.restaurants);
      } else {
        console.log('No restaurants returned from API');
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
            placeholder="Let Pachu find your taste..."
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
          <div className="flex items-center gap-2">
            {/* New Conversation Button */}
            {messages.length > 0 && (
              <button
                onClick={handleNewConversation}
                className="w-8 h-8 flex items-center justify-center bg-primary/10 hover:bg-primary/20 rounded-full transition-colors"
                title="Start new conversation"
              >
                <Plus className="w-4 h-4 text-primary" />
              </button>
            )}
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ChevronDown className="w-4 h-4 text-gray-600" />
            </button>
          </div>
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
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Suggested For You ({message.restaurants.length})
                    </p>
                  </div>
                  {message.restaurants.map((restaurant) => (
                    <div
                      key={restaurant.id}
                      onClick={() => handleRestaurantCardClick(restaurant)}
                      className="bg-gradient-to-br from-white to-primary/5 rounded-2xl p-3 border-2 border-primary/20 shadow-md active:scale-[0.98] transition-all cursor-pointer"
                      style={{ minHeight: '80px' }}
                    >
                      <div className="flex gap-3">
                        {/* Icon/Image with Primary Border Ring */}
                        <div className="w-16 h-16 flex-shrink-0 rounded-xl flex items-center justify-center p-0.5 bg-primary">
                          <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
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
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">{restaurant.name}</h4>
                          
                          {/* Rating */}
                          <div className="flex items-center gap-1 mb-1">
                            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-semibold text-gray-700">{restaurant.rating.toFixed(1)}</span>
                            <span className="text-xs text-gray-400">({restaurant.totalReviews})</span>
                            {restaurant.priceLevel && (
                              <span className="text-xs text-gray-600 ml-1">{'₪'.repeat(restaurant.priceLevel)}</span>
                            )}
                          </div>
                          
                          {/* Address */}
                          <p className="text-xs text-gray-500 truncate">{restaurant.address}</p>
                          
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
