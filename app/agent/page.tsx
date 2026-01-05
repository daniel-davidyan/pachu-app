'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, Loader2, Plus, Clock, X, Trash2, BarChart3 } from 'lucide-react';
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

interface ConversationContext {
  state: string;
  slots: {
    occasion: string | null;
    location: string | null;
    cuisine: string | null;
    vibe: string | null;
    budget: string | null;
    timing: string | null;
  };
  turnCount: number;
  lastQuestion: string | null;
}

interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  debugData?: any; // Debug data from recommendation pipeline
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
  const [currentChips, setCurrentChips] = useState<Chip[]>([]);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const [hasDevAccess, setHasDevAccess] = useState(false);
  const [latestDebugData, setLatestDebugData] = useState<any>(null);
  
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

  // Check dev access
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const response = await fetch('/api/admin/check-access');
        const data = await response.json();
        setHasDevAccess(data.hasAccess);
      } catch {
        setHasDevAccess(false);
      }
    };
    checkAccess();
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
      timestamp: Date.now(),
      debugData: latestDebugData, // Include debug data for analytics
    };

    console.log('💾 Saving conversation:', { 
      id: currentChatId, 
      messageCount: messages.length, 
      hasDebugData: !!latestDebugData,
      debugDataKeys: latestDebugData ? Object.keys(latestDebugData) : null
    });

    setChatHistory(prev => {
      const filtered = prev.filter(c => c.id !== currentChatId);
      const updated = [conversation, ...filtered].slice(0, 10);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [messages, currentChatId, latestDebugData]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [messages, isInputFocused, currentChips]);

  // Handle iOS keyboard behavior
  useEffect(() => {
    const handleResize = () => {
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
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
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
    setCurrentChips([]);
    setConversationContext(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleLoadChat = (conversation: ChatConversation) => {
    setMessages(conversation.messages);
    setCurrentChatId(conversation.id);
    setShowHistory(false);
    setCurrentChips([]);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chatHistory.filter(c => c.id !== chatId);
    setChatHistory(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    if (chatId === currentChatId) {
      handleNewChat();
    }
  };

  const handleRestaurantClick = (restaurant: Restaurant) => {
    sessionStorage.setItem('selectedRestaurant', JSON.stringify(restaurant));
    router.push(`/map?restaurantId=${restaurant.id}&lat=${restaurant.latitude}&lng=${restaurant.longitude}&fromAgent=true`);
  };

  const handleChipClick = (chip: Chip) => {
    // Construct a natural message from the chip
    const chipMessage = chip.emoji ? `${chip.emoji} ${chip.label}` : chip.label;
    setInputValue(chipMessage);
    // Immediately send the message
    handleSendWithMessage(chipMessage);
  };

  const handleSendWithMessage = async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);
    setCurrentChips([]); // Clear chips while loading

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);

    try {
      const location = userLocation || { lat: 32.0853, lng: 34.7818 };
      const conversationHistory = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Call the smart agent API with timeout for mobile networks
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout for mobile
      
      console.log('📡 Sending request to agent API...', { location });
      
      const agentResponse = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageContent,
          conversationId: currentChatId,
          previousContext: conversationContext,
          messages: conversationHistory.slice(0, -1),
          userLocation: location,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Check if response is OK first
      if (!agentResponse.ok) {
        const errorText = await agentResponse.text();
        console.error('Agent API error:', agentResponse.status, errorText);
        throw new Error(`API error: ${agentResponse.status} - ${errorText.substring(0, 100)}`);
      }

      const agentData = await agentResponse.json();
      console.log('✅ Agent response received:', agentData);

      // Update conversation context first
      if (agentData.context) {
        setConversationContext(agentData.context);
      }

      // Save debug data for analytics (if present)
      if (agentData.debugData) {
        console.log('✅ Saving debug data for analytics:', Object.keys(agentData.debugData));
        setLatestDebugData(agentData.debugData);
      } else {
        console.log('⚠️ No debugData in response');
      }

      // PRIORITY: Check for recommendations FIRST (even if there's an error field)
      // This ensures we show results if we have them
      if (agentData.recommendations && agentData.recommendations.length > 0) {
        const restaurants = agentData.recommendations.map((rec: any) => ({
          id: rec.restaurant.id || rec.restaurant.google_place_id,
          name: rec.restaurant.name,
          address: rec.restaurant.address,
          rating: rec.restaurant.google_rating || rec.restaurant.googleRating || 0,
          totalReviews: rec.restaurant.google_reviews_count || rec.restaurant.googleReviewsCount || 0,
          cuisineTypes: rec.restaurant.categories || rec.restaurant.cuisineTypes,
          priceLevel: rec.restaurant.price_level || rec.restaurant.priceLevel,
          photoUrl: rec.restaurant.photos?.[0]?.url || 
            (rec.restaurant.photos?.[0]?.photo_reference 
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${rec.restaurant.photos[0].photo_reference}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`
              : undefined),
          latitude: rec.restaurant.latitude,
          longitude: rec.restaurant.longitude,
          matchPercentage: rec.matchScore,
          source: 'google' as const,
          googlePlaceId: rec.restaurant.google_place_id || rec.restaurant.googlePlaceId,
          website: rec.restaurant.website,
        }));

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: agentData.message,
          restaurants,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setCurrentChips([]);
      } else if (agentData.error) {
        // API returned an error - show it
        console.error('Agent returned error:', agentData.error);
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: agentData.message || "משהו לא עבד, בוא ננסה שוב 🙏",
          chips: agentData.chips || [{ label: 'נסה שוב', value: 'retry', emoji: '🔄' }],
        };
        setMessages(prev => [...prev, assistantMessage]);
        setCurrentChips(agentData.chips || []);
      } else if (agentData.readyToRecommend) {
        // Ready but no recommendations found
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: agentData.message || "לא מצאתי מקומות מתאימים, אפשר לנסות לחפש משהו אחר?",
          chips: agentData.chips,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setCurrentChips(agentData.chips || []);
      } else {
        // Not ready yet, show agent response with chips
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: agentData.message || "איך אפשר לעזור?",
          chips: agentData.chips,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setCurrentChips(agentData.chips || []);
      }

    } catch (error: any) {
      console.error('Agent error:', error);
      
      // Get detailed error info for debugging
      const errorName = error?.name || 'Unknown';
      const errorMsg = error?.message || 'No message';
      const errorStack = error?.stack?.split('\n')[0] || '';
      
      let errorContent = "אופס, משהו השתבש. בוא ננסה שוב! 🙏";
      let errorChips: Chip[] = [{ label: 'נסה שוב', value: 'retry', emoji: '🔄' }];
      
      // Handle specific error types
      if (error?.name === 'AbortError') {
        errorContent = "החיפוש לקח יותר מדי זמן 😅 נראה שהרשת איטית. בוא ננסה שוב?";
        errorChips = [
          { label: 'נסה שוב', value: 'retry', emoji: '🔄' },
          { label: 'חיפוש פשוט יותר', value: 'simpler', emoji: '✨' },
        ];
      } else if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        errorContent = "נראה שיש בעיה ברשת 📶 בדוק את החיבור ונסה שוב";
        errorChips = [{ label: 'נסה שוב', value: 'retry', emoji: '🔄' }];
      }
      
      // Add debug info to error message (for troubleshooting)
      const debugInfo = `\n\n🔧 Debug: [${errorName}] ${errorMsg.substring(0, 100)}`;
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent + debugInfo,
        chips: errorChips,
      };
      setMessages(prev => [...prev, errorMessage]);
      setCurrentChips(errorChips);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  };

  const handleSend = () => {
    handleSendWithMessage(inputValue);
  };

  return (
    <div 
      className="fixed inset-0 bg-gradient-to-b from-gray-50 to-white flex flex-col overflow-hidden" 
      style={{ 
        height: '100dvh',
        touchAction: 'pan-y',
        overscrollBehavior: 'none'
      }}
    >
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
        @keyframes chipSlide {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        input[type="text"],
        input[type="email"],
        input[type="password"],
        textarea {
          font-size: 16px !important;
        }
        html {
          scroll-behavior: smooth;
          overflow-x: hidden;
        }
        body {
          overflow-x: hidden;
          overscroll-behavior-x: none;
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
              <button
                onClick={handleNewChat}
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                title="New Chat"
              >
                <Plus className="w-5 h-5 text-gray-600" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                title="Chat History"
              >
                <Clock className="w-5 h-5 text-gray-600" strokeWidth={2} />
              </button>
              {hasDevAccess && (
                <button
                  onClick={() => router.push('/agent/analytics')}
                  className="w-9 h-9 flex items-center justify-center bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-full transition-colors"
                  title="Pipeline Analytics"
                >
                  <BarChart3 className="w-5 h-5 text-white" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div 
        className="flex-1 flex flex-col min-h-0 px-4"
        style={{ 
          overflowX: 'hidden',
          touchAction: 'pan-y'
        }}
      >
        {showHistory ? (
          <>
            {/* History List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2 hide-scrollbar">
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

            <div 
              className="flex-shrink-0 py-4"
              style={{
                paddingBottom: 'calc(1rem + env(safe-area-inset-bottom) + 4rem)',
              }}
            >
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
            {/* Messages / Empty State */}
            {messages.length === 0 ? (
              <div 
                className="flex-1 min-h-0 grid place-items-center text-center px-4"
                style={{
                  touchAction: 'pan-y'
                }}
              >
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-lg">What are you craving?</h3>
                  <p className="text-sm text-gray-500 max-w-xs text-center">Tell me your mood, budget, or cuisine preferences and I&apos;ll find the perfect spot for you</p>
                </div>
              </div>
            ) : (
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-4 hide-scrollbar"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  overscrollBehaviorX: 'none',
                  touchAction: 'pan-y'
                }}
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {(message.content && (!message.restaurants || message.restaurants.length === 0)) && (
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-primary text-white rounded-br-md'
                            : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    )}
                    
                    {message.restaurants && message.restaurants.length > 0 && (
                      <div className="w-full overflow-hidden">
                        {message.content && (
                          <div className="mb-3 bg-white text-gray-900 rounded-2xl rounded-bl-md shadow-sm border border-gray-100 px-4 py-3">
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        )}
                        <div className={`grid gap-3 ${message.restaurants.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
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

                {/* Chips - Show below messages */}
                {currentChips.length > 0 && !isLoading && (
                  <div className="flex flex-wrap gap-2 py-2">
                    {currentChips.map((chip, index) => (
                      <button
                        key={`${chip.value}-${index}`}
                        onClick={() => handleChipClick(chip)}
                        className="px-4 py-2 bg-white border-2 border-primary/30 rounded-full text-sm font-medium text-gray-700 hover:bg-primary/10 hover:border-primary/50 transition-all active:scale-95 shadow-sm"
                        style={{
                          animation: `chipSlide 0.3s ease-out ${index * 0.05}s both`
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
            )}

            {/* Subtle divider line */}
            <div className="h-px bg-gray-200 mx-2" />

            {/* Input Area */}
            <div 
              className="flex-shrink-0"
              style={{
                paddingTop: '0.75rem',
                paddingBottom: isInputFocused 
                  ? '0.25rem'
                  : 'calc(env(safe-area-inset-bottom) + 5rem)',
                transition: 'padding-bottom 0.15s ease-out'
              }}
            >
              <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-3xl px-4 py-2.5 focus-within:border-primary transition-colors shadow-md">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => {
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
                  className="flex-1 bg-transparent outline-none text-base text-gray-900 placeholder-gray-400 resize-none overflow-hidden max-h-32 leading-6"
                  style={{
                    minHeight: '24px',
                    fontSize: '16px',
                    lineHeight: '24px'
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
                      ? 'linear-gradient(to right, #C5459C, rgba(197, 69, 156, 0.9))' 
                      : '#E5E7EB'
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all active:scale-95 flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <Send 
                      className="w-5 h-5 stroke-[2.5]"
                      style={{ color: inputValue.trim() ? '#FFFFFF' : '#6B7280' }}
                    />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav show={!isInputFocused} />
    </div>
  );
}
