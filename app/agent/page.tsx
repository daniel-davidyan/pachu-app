'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, Loader2, Plus, Clock, X, Trash2 } from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  rating: number;
  totalReviews: number;
  cuisineTypes?: string[];
  priceLevel?: number;
  photoUrl?: string;
  latitude: number;
  longitude: number;
  matchPercentage?: number;
  source: 'google' | 'friends' | 'own';
  googlePlaceId?: string;
  website?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Restaurant[];
}

interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

const STORAGE_KEY = 'pachu-chat-history';

// Helper function to get restaurant icon emoji
const getRestaurantIcon = (restaurant: Restaurant): string => {
  const cuisines = restaurant.cuisineTypes || [];
  const name = restaurant.name.toLowerCase();
  const allText = [...cuisines, name].join(' ').toLowerCase();
  
  if (allText.includes('coffee') || allText.includes('cafe')) return '☕';
  if (allText.includes('pizza')) return '🍕';
  if (allText.includes('sushi') || allText.includes('japanese')) return '🍣';
  if (allText.includes('chinese')) return '🥡';
  if (allText.includes('burger')) return '🍔';
  if (allText.includes('mexican') || allText.includes('taco')) return '🌮';
  if (allText.includes('indian') || allText.includes('curry')) return '🍛';
  if (allText.includes('italian') || allText.includes('pasta')) return '🍝';
  if (allText.includes('bakery')) return '🥐';
  if (allText.includes('ice cream') || allText.includes('dessert')) return '🍨';
  if (allText.includes('bar') || allText.includes('wine')) return '🍷';
  if (allText.includes('seafood') || allText.includes('fish')) return '🦐';
  if (allText.includes('steak') || allText.includes('grill')) return '🥩';
  
  return '🍽️';
};

// Helper function to get price level string
const getPriceLevel = (priceLevel?: number): string => {
  if (!priceLevel) return '$$';
  return '$'.repeat(priceLevel);
};

// Restaurant card component with image error handling
function RestaurantCard({ restaurant, messageId, index, onRestaurantClick }: { 
  restaurant: Restaurant; 
  messageId: string; 
  index: number;
  onRestaurantClick?: (restaurant: Restaurant) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const matchPercentage = restaurant.matchPercentage || 75;

  return (
    <div
      key={`${messageId}-${restaurant.id || index}`}
      onClick={() => {
        if (onRestaurantClick) {
          onRestaurantClick(restaurant);
        }
      }}
      className="group relative bg-white rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]"
      style={{
        animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
      }}
    >
      {/* Match percentage badge */}
      <div 
        className="absolute top-2 right-2 z-10 backdrop-blur-sm rounded-full px-2 py-0.5 font-bold text-[10px] shadow-md"
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          color: '#6B7280'
        }}
      >
        {matchPercentage}%
      </div>
      
      {/* Restaurant Photo */}
      <div className="relative w-full h-32 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
        {restaurant.photoUrl && !imageError ? (
          <img
            src={restaurant.photoUrl}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={() => {
              console.warn(`Image failed for ${restaurant.name}, showing fallback icon`);
              setImageError(true);
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 via-pink-100 to-orange-50 flex items-center justify-center">
            <span className="text-5xl opacity-60">{getRestaurantIcon(restaurant)}</span>
          </div>
        )}
      </div>
      
      {/* Restaurant Info */}
      <div className="p-3">
        <h3 className="font-bold text-gray-900 text-sm leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
          {restaurant.name}
        </h3>
        
        {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
          <div className="mb-2">
            <span className="text-xs bg-gradient-to-r from-primary/10 to-pink-50 text-primary font-semibold px-2 py-1 rounded-full border border-primary/20">
              {restaurant.cuisineTypes[0].replace(/_/g, ' ').toLowerCase()}
            </span>
          </div>
        )}
        
        {restaurant.priceLevel && (
          <div className="text-left">
            <span className="font-bold text-emerald-600 text-sm">
              {getPriceLevel(restaurant.priceLevel)}
            </span>
          </div>
        )}
      </div>
      
      {/* Hover indicator bar */}
      <div 
        className="h-0.5 bg-gradient-to-r from-primary via-pink-500 to-orange-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
      />
    </div>
  );
}

export default function AgentPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatConversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          setUserLocation({ lat: 32.0853, lng: 34.7818 });
        }
      );
    } else {
      setUserLocation({ lat: 32.0853, lng: 34.7818 });
    }
  }, []);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const history = JSON.parse(stored);
        setChatHistory(history);
        // Load the most recent chat if exists
        if (history.length > 0) {
          const mostRecent = history[0];
          setCurrentChatId(mostRecent.id);
          setMessages(mostRecent.messages);
        } else {
          // Create new chat if no history
          setCurrentChatId(Date.now().toString());
        }
      } catch (e) {
        console.error('Failed to load chat history', e);
        setCurrentChatId(Date.now().toString());
      }
    } else {
      setCurrentChatId(Date.now().toString());
    }
  }, []);

  // Save current conversation to history when messages change
  useEffect(() => {
    if (messages.length === 0 || !currentChatId) return;
    
    const title = generateChatTitle(messages);
    const conversation: ChatConversation = {
      id: currentChatId,
      title,
      messages,
      timestamp: Date.now()
    };

    setChatHistory(prev => {
      const filtered = prev.filter(c => c.id !== currentChatId);
      const updated = [conversation, ...filtered].slice(0, 10); // Keep max 10 conversations
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [messages, currentChatId]);

  // Scroll to bottom when new messages arrive or when keyboard appears
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      // Use a slight delay to ensure DOM has updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [messages, isInputFocused]);

  // Handle iOS keyboard behavior
  useEffect(() => {
    const handleResize = () => {
      // When keyboard opens, scroll to bottom
      if (isInputFocused && messagesEndRef.current) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 300);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInputFocused]);

  const generateChatTitle = (messages: Message[]): string => {
    // Find first user message
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      // Truncate to first 40 characters
      const content = firstUserMsg.content.trim();
      return content.length > 40 ? content.substring(0, 40) + '...' : content;
    }
    return 'New conversation';
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(Date.now().toString());
    setShowHistory(false);
    setInputValue('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleLoadChat = (conversation: ChatConversation) => {
    setMessages(conversation.messages);
    setCurrentChatId(conversation.id);
    setShowHistory(false);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chatHistory.filter(c => c.id !== chatId);
    setChatHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // If deleting current chat, start new one
    if (chatId === currentChatId) {
      handleNewChat();
    }
  };

  const handleRestaurantClick = (restaurant: Restaurant) => {
    // Navigate to map with the selected restaurant
    router.push(`/map?restaurantId=${restaurant.id}&lat=${restaurant.latitude}&lng=${restaurant.longitude}`);
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

    // Scroll to bottom after adding message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

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

      // Scroll to bottom after assistant response
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);

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

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-50 to-white flex flex-col" style={{ height: '100dvh', width: '100vw', overflow: 'hidden', touchAction: 'pan-y' }}>
      {/* Global styles for animations and iOS keyboard handling */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Hide scrollbar for webkit browsers */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* Lock horizontal scroll completely */
        * {
          overscroll-behavior-x: none !important;
        }
        
        body, html {
          overflow-x: hidden !important;
          max-width: 100vw !important;
          position: relative !important;
        }
        
        /* Prevent iOS zoom on input focus */
        input[type="text"],
        input[type="email"],
        input[type="password"],
        textarea {
          font-size: 16px !important;
        }
        
        /* Smooth scrolling */
        html {
          scroll-behavior: smooth;
        }
      `}</style>

      {/* Header */}
      <div 
        className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3"
        style={{
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
        }}
      >
        {showHistory ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-white" strokeWidth={2} />
              </div>
              <h2 className="font-bold text-gray-900 text-base">Chat History</h2>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900 text-base">Pachu Taste Model</h2>
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-primary/80 to-pink-500/80 text-white rounded shadow-sm">
                    Beta
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* New Chat Button */}
              <button
                onClick={handleNewChat}
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                title="New Chat"
              >
                <Plus className="w-5 h-5 text-gray-600" strokeWidth={2.5} />
              </button>
              {/* History Button */}
              <button
                onClick={() => setShowHistory(true)}
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                title="Chat History"
              >
                <Clock className="w-5 h-5 text-gray-600" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ maxWidth: '100%' }}>
        {showHistory ? (
          <>
            {/* History List */}
            <div 
              className="flex-1 overflow-y-auto py-4 px-4 space-y-2 hide-scrollbar"
              style={{ 
                overflowX: 'hidden',
                maxWidth: '100%',
                touchAction: 'pan-y'
              }}
            >
              {chatHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-base text-gray-500">No chat history yet</p>
                </div>
              ) : (
                chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleLoadChat(chat)}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                      chat.id === currentChatId
                        ? 'bg-primary/5 border-primary shadow-sm'
                        : 'bg-white border-gray-200 hover:border-primary/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-base text-gray-900 truncate mb-1">
                          {chat.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {new Date(chat.timestamp).toLocaleDateString()} • {chat.messages.length} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-full"
                      >
                        <Trash2 className="w-5 h-5 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* New Chat Button */}
            <div className="flex-shrink-0 py-4 px-4 pb-safe">
              <button
                onClick={handleNewChat}
                className="w-full py-3 px-4 bg-gradient-to-r from-primary to-primary/80 text-white rounded-full font-semibold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
                Start New Chat
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Messages */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto py-4 px-4 space-y-4 hide-scrollbar"
              style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
                overscrollBehaviorX: 'none',
                overflowX: 'hidden',
                maxWidth: '100%',
                touchAction: 'pan-y'
              }}
            >
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-lg">Your Personal Dining Expert</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">Tell me what you're craving, your budget, vibe, or even a specific restaurant name...</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  style={{ maxWidth: '100%', overflow: 'hidden' }}
                >
                  {/* Only show message bubble if there's content or no restaurants */}
                  {(message.content && (!message.restaurants || message.restaurants.length === 0)) && (
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-primary text-white rounded-br-md'
                          : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                      }`}
                      style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                  )}
                  
                  {/* Show restaurants if available */}
                  {message.restaurants && message.restaurants.length > 0 && (
                    <div className="w-full" style={{ overflow: 'hidden', maxWidth: '100%' }}>
                      <div className={`grid gap-2 ${message.restaurants.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} style={{ width: '100%' }}>
                        {message.restaurants.map((restaurant, index) => (
                          <RestaurantCard
                            key={`${message.id}-${restaurant.id || index}`}
                            restaurant={restaurant}
                            messageId={message.id}
                            index={index}
                            onRestaurantClick={handleRestaurantClick}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white shadow-sm border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Fixed at bottom with NO GAP when keyboard is open */}
            <div 
              className="flex-shrink-0 bg-white border-t border-gray-200 px-4"
              style={{
                paddingTop: '8px',
                paddingBottom: isInputFocused 
                  ? 'env(safe-area-inset-bottom, 0px)' 
                  : 'calc(8px + 3.5rem + env(safe-area-inset-bottom))',
                transition: 'padding-bottom 0.2s ease-out',
                marginBottom: isInputFocused ? '0' : undefined
              }}
            >
              <div 
                className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:border-primary/50 focus-within:bg-white transition-all"
                style={{ 
                  marginBottom: isInputFocused ? '8px' : '8px',
                  maxWidth: '100%'
                }}
              >
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
                    // Delay blur to allow button clicks to register
                    setTimeout(() => setIsInputFocused(false), 100);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="What are you craving?"
                  rows={1}
                  className="flex-1 bg-transparent outline-none text-base text-gray-900 placeholder-gray-500 resize-none overflow-hidden py-1.5"
                  style={{
                    minHeight: '24px',
                    maxHeight: '120px',
                    fontSize: '16px' // Prevent iOS zoom
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all ${
                    inputValue.trim() && !isLoading
                      ? 'bg-primary hover:bg-primary/90 active:scale-95' 
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin text-white" />
                  ) : (
                    <Send 
                      className="w-4.5 h-4.5 text-white"
                      strokeWidth={2}
                    />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation - Hide when input is focused */}
      <BottomNav show={!isInputFocused} />
    </div>
  );
}

