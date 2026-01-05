'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, ChevronDown, Plus, Clock, X, Trash2 } from 'lucide-react';

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

interface Chip {
  label: string;
  value: string;
  emoji?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Restaurant[];
  chips?: Chip[];
}

interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

interface AIChatSheetProps {
  onFilterChange?: (filters: RestaurantFilters) => void;
  onRestaurantsFound?: (restaurants: Restaurant[]) => void;
  onRestaurantClick?: (restaurant: Restaurant) => void;
  matchedCount?: number;
  userLocation?: { lat: number; lng: number } | null;
  onChatStateChange?: (isActive: boolean, height: number) => void;
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

const STORAGE_KEY = 'pachu-chat-history';

// Conversation context tracking
interface ConversationContext {
  where: string | null;
  withWho: string | null;
  purpose: string | null;
  budget: string | null;
  when: string | null;
  cuisinePreference: string | null;
  additionalNotes: string[];
}

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

// Helper function to get match percentage color
const getMatchColor = (percentage: number): string => {
  if (percentage >= 90) return '#10B981'; // Green
  if (percentage >= 80) return '#059669'; // Darker green
  if (percentage >= 70) return '#C5459C'; // Primary pink
  if (percentage >= 60) return '#EC4899'; // Lighter pink
  return '#6B7280'; // Gray
};

// Restaurant card component - Modern design with full image overlay
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
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] flex-shrink-0"
      style={{
        animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
        width: '120px',
        height: '150px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
      }}
    >
      {/* Full Background Image */}
      <div className="absolute inset-0 w-full h-full">
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
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-pink-200 to-orange-100 flex items-center justify-center">
            <span className="text-4xl opacity-70">{getRestaurantIcon(restaurant)}</span>
          </div>
        )}
      </div>
      
      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      
      {/* Match percentage badge - Top Right with Pink Background */}
      <div 
        className="absolute top-2 right-2 z-10 rounded-full px-2.5 py-1 font-bold text-xs shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #EC4899, #C5459C)',
          color: '#FFFFFF'
        }}
      >
        {matchPercentage}%
      </div>
      
      {/* Restaurant Name - Bottom with White Text */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="font-bold text-white text-sm leading-tight line-clamp-2 drop-shadow-lg">
          {restaurant.name}
        </h3>
        {restaurant.cuisineTypes && restaurant.cuisineTypes.length > 0 && (
          <p className="text-white/80 text-[10px] mt-0.5 font-medium">
            {restaurant.cuisineTypes[0].replace(/_/g, ' ').toLowerCase()}
          </p>
        )}
      </div>
    </div>
  );
}

// Friends who visited component
interface FriendAvatar {
  name: string;
  imageUrl?: string;
}

function FriendsWhoVisited({ friends, restaurantName }: { friends: FriendAvatar[]; restaurantName: string }) {
  if (!friends || friends.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex -space-x-2">
        {friends.slice(0, 3).map((friend, idx) => (
          <div
            key={idx}
            className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-primary/20 to-pink-100 flex items-center justify-center overflow-hidden"
          >
            {friend.imageUrl ? (
              <img src={friend.imageUrl} alt={friend.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-primary">
                {friend.name.charAt(0)}
              </span>
            )}
          </div>
        ))}
      </div>
      <span className="text-[11px] text-gray-600">
        {friends.length === 1 
          ? `${friends[0].name} היה כאן`
          : `${friends[0].name} ו-${friends.length - 1} נוספים היו כאן`
        }
      </span>
    </div>
  );
}

export function AIChatSheet({ onFilterChange, onRestaurantsFound, onRestaurantClick, matchedCount = 0, userLocation, onChatStateChange }: AIChatSheetProps) {
  const [isActive, setIsActive] = useState(false); // Whether pane is visible
  const [sheetHeight, setSheetHeight] = useState(200); // Height when active
  const [isDragging, setIsDragging] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [maxHeight, setMaxHeight] = useState(700);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatConversation[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const [currentChips, setCurrentChips] = useState<Chip[]>([]);
  
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const minHeight = 200; // Minimum when pane is visible

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
        }
      } catch (e) {
        console.error('Failed to load chat history', e);
      }
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

  // Calculate max height on client side only
  useEffect(() => {
    setMaxHeight(window.innerHeight - 100);
  }, []);

  // Notify parent of chat state changes
  useEffect(() => {
    if (onChatStateChange) {
      onChatStateChange(isActive, sheetHeight);
    }
  }, [isActive, sheetHeight, onChatStateChange]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (sheetHeight > 200) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sheetHeight]);

  // Handle drag start
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    dragStartHeight.current = sheetHeight;
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    e.preventDefault();
  };

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
        handleClose(); // Close pane if dragged too low
      } else if (sheetHeight < 350) {
        setSheetHeight(200); // Snap to small
      } else if (sheetHeight < 500) {
        setSheetHeight(400); // Snap to medium
      } else if (sheetHeight < maxHeight - 100) {
        setSheetHeight(600); // Snap to large
      } else {
        setSheetHeight(maxHeight); // Snap to full
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
  }, [isDragging, sheetHeight, maxHeight]);

  const handleActivate = () => {
    setIsActive(true);
    // Set height to 50% of screen height on first open
    const halfScreenHeight = window.innerHeight * 0.5;
    setSheetHeight(Math.min(halfScreenHeight, maxHeight));
    setShowHistory(false);
    // Create new chat if none exists
    if (!currentChatId) {
      setCurrentChatId(Date.now().toString());
    }
    // Auto-focus input when pane opens
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleExpand = () => {
    setIsActive(true);
    setSheetHeight(500);
    // Initialize conversation if empty
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "Hey! 👋 I'm here to help you find the perfect spot. What are you in the mood for?"
      }]);
    }
  };

  const handleClose = () => {
    setIsActive(false);
    setInputValue('');
    setShowHistory(false);
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentChatId(Date.now().toString());
    setShowHistory(false);
    setInputValue('');
    setConversationContext(null);
    setCurrentChips([]);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleChipClick = (chip: Chip) => {
    // Set the chip value as input and send
    const chipText = chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label;
    setInputValue(chip.label);
    setCurrentChips([]); // Clear chips after selection
    // Trigger send with the chip value
    setTimeout(() => {
      handleSendWithValue(chip.label);
    }, 50);
  };

  const handleSendWithValue = async (value: string) => {
    if (!value.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: value
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setCurrentChips([]);

    // Auto-expand if small
    if (!isActive || sheetHeight < 300) {
      setIsActive(true);
      setSheetHeight(400);
    }

    await processAgentResponse([...messages, userMessage]);
  };

  const processAgentResponse = async (allMessages: Message[]) => {
    try {
      const location = userLocation || { lat: 32.0853, lng: 34.7818 };
      const conversationHistory = allMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // First, call the smart agent to process the message
      const agentResponse = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: allMessages[allMessages.length - 1].content,
          conversationId: currentChatId,
          previousContext: conversationContext,
          messages: conversationHistory.slice(0, -1), // All except current
          userLocation: location,
        })
      });

      const agentData = await agentResponse.json();

      if (agentData.error) {
        throw new Error(agentData.error);
      }

      // Update conversation context
      if (agentData.context) {
        setConversationContext(agentData.context);
      }

      // If ready to recommend, call the recommend API
      if (agentData.readyToRecommend) {
        const recommendResponse = await fetch('/api/agent/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationHistory,
            latitude: location.lat,
            longitude: location.lng,
            radiusMeters: 5000,
            conversationId: currentChatId,
            context: agentData.context,
          })
        });

        const recommendData = await recommendResponse.json();

        if (recommendData.recommendations && recommendData.recommendations.length > 0) {
          const restaurants = recommendData.recommendations.map((rec: any) => ({
            id: rec.restaurant.id,
            name: rec.restaurant.name,
            address: rec.restaurant.address,
            rating: rec.restaurant.googleRating || rec.restaurant.rating || 0,
            totalReviews: rec.restaurant.googleReviewsCount || 0,
            cuisineTypes: rec.restaurant.cuisineTypes,
            priceLevel: rec.restaurant.priceLevel,
            photoUrl: rec.restaurant.photos?.[0]?.url || 
              (rec.restaurant.photos?.[0]?.photoReference 
                ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${rec.restaurant.photos[0].photoReference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
                : undefined),
            latitude: rec.restaurant.latitude,
            longitude: rec.restaurant.longitude,
            matchPercentage: rec.matchScore,
            source: 'google' as const,
            googlePlaceId: rec.restaurant.googlePlaceId,
            website: rec.restaurant.website,
          }));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
            content: recommendData.explanation || agentData.message,
            restaurants,
      };

      setMessages(prev => [...prev, assistantMessage]);
          onRestaurantsFound?.(restaurants);
          setCurrentChips([]);
        } else {
          // No recommendations found
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: agentData.message || "Let me search for some options...",
            chips: agentData.chips,
          };
          setMessages(prev => [...prev, assistantMessage]);
          setCurrentChips(agentData.chips || []);
      }
      } else {
        // Not ready yet, show agent response with chips
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: agentData.message,
          chips: agentData.chips,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setCurrentChips(agentData.chips || []);
      }

    } catch (error) {
      console.error('Agent error:', error);
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

  const handleLoadChat = (conversation: ChatConversation) => {
    setMessages(conversation.messages);
    setCurrentChatId(conversation.id);
    setShowHistory(false);
    setSheetHeight(500);
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

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) {
      return;
    }

    await handleSendWithValue(inputValue);
  };

  // If not active, show only floating search bar (positioned above nav-bar)
  if (!isActive) {
    return (
      <>
        <div 
          className="fixed z-40"
          style={{
            bottom: 'calc(4.75rem + env(safe-area-inset-bottom))',
            left: 'max(1rem, env(safe-area-inset-left))',
            right: 'max(1rem, env(safe-area-inset-right))',
          }}
        >
          <div className="flex items-start gap-2 bg-white border-2 border-gray-200 rounded-full px-4 py-2 shadow-xl focus-within:border-primary transition-all hover:shadow-2xl">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <textarea
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (!isActive) handleActivate();
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onFocus={handleActivate}
              placeholder="What are you craving? 🍽️"
              rows={1}
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400 font-medium resize-none overflow-hidden py-0.5"
              style={{
                maxHeight: '100px',
                minHeight: '20px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 100) + 'px';
              }}
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
        
        {/* Global styles for animations */}
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
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          .animate-fadeIn {
            animation: fadeIn 0.3s ease-out;
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
        `}</style>
      </>
    );
  }

  // Active pane with conversation - extends to bottom with padding
  return (
    <div
      ref={sheetRef}
      className="fixed z-40 rounded-3xl shadow-2xl border border-white/30 transition-all duration-200 ease-out overflow-hidden"
      style={{ 
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        left: 'max(0.75rem, env(safe-area-inset-left))',
        right: 'max(0.75rem, env(safe-area-inset-right))',
        height: sheetHeight,
        maxHeight: maxHeight,
        background: 'linear-gradient(180deg, #FDF2F8 0%, #FCE7F3 30%, #FECDD3 70%, #FED7AA 100%)',
      }}
    >
      {/* Drag Handle */}
      <div
        className="flex flex-col items-center pt-2 pb-2 cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="w-10 h-1.5 bg-white/60 rounded-full shadow-sm" />
      </div>

      {/* Content */}
      <div className="flex flex-col h-[calc(100%-24px)] px-4 pb-3">
        
        {/* History View */}
        {showHistory ? (
          <>
            {/* History Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                  <Clock className="w-5 h-5 text-primary" strokeWidth={2} />
                </div>
                <h2 className="font-bold text-gray-800 text-sm">היסטוריית שיחות</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-all shadow-md hover:shadow-lg"
              >
                <X className="w-4.5 h-4.5 text-gray-700" strokeWidth={2.5} />
              </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto space-y-2 hide-scrollbar" style={{
              WebkitOverflowScrolling: 'touch'
            }}>
              {chatHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-gray-600">אין היסטוריית שיחות עדיין</p>
                </div>
              ) : (
                chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleLoadChat(chat)}
                    className={`p-3 rounded-2xl transition-all cursor-pointer group ${
                      chat.id === currentChatId
                        ? 'bg-white/90 shadow-lg'
                        : 'bg-white/70 hover:bg-white/90 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-800 truncate mb-1">
                          {chat.title}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(chat.timestamp).toLocaleDateString()} • {chat.messages.length} הודעות
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 rounded-full"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* New Chat Button */}
            <div className="mt-3 flex-shrink-0">
              <button
                onClick={handleNewChat}
                className="w-full py-3 px-4 text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #EC4899, #C5459C)',
                }}
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
                התחל שיחה חדשה
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-gray-800 text-sm">Pachu Taste Model</h2>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/80 text-primary rounded shadow-sm">
                      Beta
                    </span>
                  </div>
                  {matchedCount > 0 && (
                    <p className="text-xs text-gray-600">{matchedCount} מקומות נמצאו</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* New Chat Button */}
                <button
                  onClick={handleNewChat}
                  className="w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-all shadow-md hover:shadow-lg"
                  title="New Chat"
                >
                  <Plus className="w-4.5 h-4.5 text-gray-700" strokeWidth={2.5} />
                </button>
                {/* History Button */}
                <button
                  onClick={() => {
                    setShowHistory(true);
                    setSheetHeight(500);
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-all shadow-md hover:shadow-lg"
                  title="Chat History"
                >
                  <Clock className="w-4.5 h-4.5 text-gray-700" strokeWidth={2} />
                </button>
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-all shadow-md hover:shadow-lg"
                >
                  <ChevronDown className="w-4.5 h-4.5 text-gray-700" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-3 space-y-4 hide-scrollbar" style={{
              WebkitOverflowScrolling: 'touch'
            }}>
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-2 shadow-lg backdrop-blur-sm">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1 text-sm">המומחה הקולינרי שלך</h3>
                  <p className="text-xs text-gray-600">ספר לי מה בא לך, התקציב שלך, האווירה או אפילו שם של מסעדה ספציפית...</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {/* User message - Pink bubble aligned right */}
                  {message.role === 'user' && (
                    <div
                      className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md shadow-md"
                      style={{
                        background: 'linear-gradient(135deg, #EC4899, #C5459C)',
                      }}
                    >
                      <p className="text-sm text-white whitespace-pre-wrap font-medium">{message.content}</p>
                    </div>
                  )}
                  
                  {/* Assistant message - Modern container */}
                  {message.role === 'assistant' && (
                    <div className="w-full">
                      {/* Show restaurants FIRST if available */}
                      {message.restaurants && message.restaurants.length > 0 && (
                        <div className="mb-3">
                          {/* Horizontal scrolling restaurant cards */}
                          <div 
                            className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                          >
                            {message.restaurants.map((restaurant, index) => (
                              <RestaurantCard
                                key={`${message.id}-${restaurant.id || index}`}
                                restaurant={restaurant}
                                messageId={message.id}
                                index={index}
                                onRestaurantClick={onRestaurantClick}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Explanation/Reasoning text AFTER restaurants - in modern container */}
                      {message.content && (
                        <div
                          className="bg-white/80 backdrop-blur-sm rounded-2xl rounded-tl-md px-4 py-3 shadow-md border border-white/50"
                          style={{ maxWidth: '95%' }}
                        >
                          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/80 backdrop-blur-sm shadow-md px-4 py-3 rounded-2xl rounded-tl-md">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                </div>
              )}

              {/* Quick Reply Chips */}
              {currentChips.length > 0 && !isLoading && (
                <div className="flex flex-wrap gap-2 mt-2 mb-1 animate-fadeIn">
                  {currentChips.map((chip, index) => (
                    <button
                      key={`chip-${index}-${chip.value}`}
                      onClick={() => handleChipClick(chip)}
                      className="px-4 py-2 bg-white/90 backdrop-blur-sm border border-white/50 text-gray-700 rounded-full text-sm font-medium 
                        hover:bg-white hover:shadow-lg hover:scale-105
                        active:scale-95 transition-all duration-200 shadow-md"
                      style={{
                        animation: `slideIn 0.3s ease-out ${index * 0.05}s both`
                      }}
                    >
                      {chip.emoji && <span className="mr-1.5">{chip.emoji}</span>}
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0">
              <div className="flex items-end gap-2 bg-white/90 backdrop-blur-sm border border-white/50 rounded-full px-4 py-2 focus-within:shadow-lg transition-all shadow-md">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="מה בא לך? 🍽️"
                  rows={1}
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-500 resize-none overflow-hidden py-0.5 max-h-32"
                  style={{
                    minHeight: '20px'
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading}
                  style={{
                    background: inputValue.trim() 
                      ? 'linear-gradient(135deg, #EC4899, #C5459C)' 
                      : 'rgba(255,255,255,0.6)'
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all active:scale-95 flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send 
                      className="w-4 h-4 stroke-[2.5]"
                      style={{ color: inputValue.trim() ? '#FFFFFF' : '#9CA3AF' }}
                    />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
