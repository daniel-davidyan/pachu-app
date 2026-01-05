'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Sparkles, Loader2, Plus, Clock, X, Trash2, BarChart3, Laptop, Armchair, Coffee, Users, MapPin, Utensils, Heart, Wallet, Leaf, Pizza, Fish, Beef, Salad, IceCream, Wine, Beer, Soup, Sandwich, Egg, Apple, Globe, Sun, Moon, PartyPopper, Baby, Dog, Music, Wifi, Car, TreePine, Building, Home, Flame, Snowflake, Zap, Star, type LucideIcon } from 'lucide-react';
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

// Helper function to get modern icon for chip based on content
const getChipIcon = (label: string, value: string): LucideIcon => {
  const text = (label + ' ' + value).toLowerCase();
  
  // Work & Study
  if (text.includes('עבודה') || text.includes('לפטופ') || text.includes('work') || text.includes('laptop')) return Laptop;
  if (text.includes('ישיבה') || text.includes('seat') || text.includes('מקום') || text.includes('הזמנ')) return Armchair;
  if (text.includes('wifi') || text.includes('אינטרנט')) return Wifi;
  
  // Social
  if (text.includes('חברים') || text.includes('friend') || text.includes('קבוצה') || text.includes('group')) return Users;
  if (text.includes('רומנטי') || text.includes('דייט') || text.includes('date') || text.includes('זוג')) return Heart;
  if (text.includes('משפחה') || text.includes('family') || text.includes('ילדים')) return Home;
  if (text.includes('תינוק') || text.includes('baby')) return Baby;
  if (text.includes('כלב') || text.includes('dog') || text.includes('חיות')) return Dog;
  if (text.includes('מסיבה') || text.includes('party') || text.includes('חגיגה') || text.includes('יומהולדת')) return PartyPopper;
  
  // Location & Cities
  if (text.includes('תל אביב') || text.includes('tel aviv') || text.includes('tlv')) return Building;
  if (text.includes('ירושלים') || text.includes('jerusalem')) return Building;
  if (text.includes('חיפה') || text.includes('haifa')) return Building;
  if (text.includes('הרצליה') || text.includes('herzliya')) return Building;
  if (text.includes('רמת גן') || text.includes('ramat gan')) return Building;
  if (text.includes('בכל') || text.includes('כל ה') || text.includes('באזור') || text.includes('סביבה')) return MapPin;
  if (text.includes('מיקום') || text.includes('location') || text.includes('איפה') || text.includes('קרוב')) return MapPin;
  if (text.includes('חוץ') || text.includes('outdoor') || text.includes('גינה') || text.includes('מרפסת')) return TreePine;
  if (text.includes('פנים') || text.includes('indoor')) return Building;
  if (text.includes('חניה') || text.includes('parking') || text.includes('רכב')) return Car;
  if (text.includes('ים') || text.includes('חוף') || text.includes('beach')) return Sun;
  
  // Food Types
  if (text.includes('אסייתי') || text.includes('asian') || text.includes('סיני') || text.includes('יפני') || text.includes('תאילנדי')) return Globe;
  if (text.includes('איטלקי') || text.includes('italian') || text.includes('פיצה') || text.includes('פסטה')) return Pizza;
  if (text.includes('בשר') || text.includes('meat') || text.includes('סטייק') || text.includes('המבורגר')) return Beef;
  if (text.includes('דג') || text.includes('fish') || text.includes('סושי') || text.includes('ים')) return Fish;
  if (text.includes('סלט') || text.includes('salad') || text.includes('טרי')) return Salad;
  if (text.includes('בריא') || text.includes('healthy') || text.includes('טבעוני') || text.includes('צמחוני')) return Leaf;
  if (text.includes('קינוח') || text.includes('dessert') || text.includes('מתוק') || text.includes('גלידה')) return IceCream;
  if (text.includes('מרק') || text.includes('soup')) return Soup;
  if (text.includes('סנדוויץ') || text.includes('sandwich') || text.includes('כריך')) return Sandwich;
  if (text.includes('ארוחת בוקר') || text.includes('breakfast') || text.includes('בוקר')) return Egg;
  if (text.includes('פרי') || text.includes('fruit')) return Apple;
  
  // Drinks
  if (text.includes('קפה') || text.includes('coffee') || text.includes('בית קפה')) return Coffee;
  if (text.includes('יין') || text.includes('wine')) return Wine;
  if (text.includes('בירה') || text.includes('beer') || text.includes('בר')) return Beer;
  
  // Vibe & Atmosphere  
  if (text.includes('שקט') || text.includes('quiet') || text.includes('רגוע')) return Moon;
  if (text.includes('חי') || text.includes('lively') || text.includes('אנרגטי') || text.includes('תוסס')) return Zap;
  if (text.includes('מוזיקה') || text.includes('music') || text.includes('dj')) return Music;
  if (text.includes('חם') || text.includes('hot') || text.includes('חורף')) return Flame;
  if (text.includes('קר') || text.includes('cold') || text.includes('קיץ') || text.includes('מזגן')) return Snowflake;
  if (text.includes('שמש') || text.includes('sun') || text.includes('צהריים')) return Sun;
  if (text.includes('ערב') || text.includes('לילה') || text.includes('night')) return Moon;
  
  // Budget
  if (text.includes('תקציב') || text.includes('מחיר') || text.includes('budget') || text.includes('זול') || text.includes('יקר')) return Wallet;
  
  // Food general
  if (text.includes('אוכל') || text.includes('food') || text.includes('מסעדה') || text.includes('לאכול')) return Utensils;
  
  // Surprise / Other
  if (text.includes('הפתע') || text.includes('surprise') || text.includes('תפתיע')) return Star;
  
  // Default
  return Utensils;
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
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] active:scale-[0.97]"
      style={{
        animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
        height: '160px',
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
            <span className="text-5xl opacity-70">{getRestaurantIcon(restaurant)}</span>
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
          <p className="text-white/80 text-[11px] mt-0.5 font-medium">
            {restaurant.cuisineTypes[0].replace(/_/g, ' ').toLowerCase()}
          </p>
        )}
      </div>
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
    // Send just the label without emoji for cleaner messages
    setInputValue(chip.label);
    // Immediately send the message
    handleSendWithMessage(chip.label);
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
      className="fixed inset-0 flex flex-col overflow-hidden" 
      style={{ 
        height: '100dvh',
        touchAction: 'pan-y',
        overscrollBehavior: 'none',
        background: 'linear-gradient(135deg, #FCE7F3 0%, #FDF2F8 60%, #FFFFFF 100%)',
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
        className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-white/50 px-4 py-3"
        style={{
          paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
        }}
      >
        {showHistory ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                <Clock className="w-5 h-5 text-primary" strokeWidth={2} />
              </div>
              <h2 className="font-bold text-gray-800 text-base">היסטוריית שיחות</h2>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="w-9 h-9 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-all shadow-md hover:shadow-lg"
            >
              <X className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-800 text-base">Pachu Agent</h2>
                  <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/80 text-primary rounded shadow-sm">
                    Beta
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleNewChat}
                className="w-9 h-9 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-all shadow-md hover:shadow-lg"
                title="New Chat"
              >
                <Plus className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className="w-9 h-9 flex items-center justify-center bg-white/80 hover:bg-white rounded-full transition-all shadow-md hover:shadow-lg"
                title="Chat History"
              >
                <Clock className="w-5 h-5 text-gray-700" strokeWidth={2} />
              </button>
              <button
                onClick={() => router.push('/agent/analytics')}
                className="w-9 h-9 flex items-center justify-center bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-full transition-colors shadow-md"
                title="Pipeline Analytics"
              >
                <BarChart3 className="w-5 h-5 text-white" strokeWidth={2} />
              </button>
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
                            {/* Restaurant cards grid */}
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
                    <div className="bg-white shadow-sm border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  </div>
                )}

                {/* Chips - Modern 2x2 grid */}
                {currentChips.length > 0 && !isLoading && (
                  <div className="grid grid-cols-2 gap-2 py-2">
                    {currentChips.slice(0, 4).map((chip, index) => {
                      const IconComponent = getChipIcon(chip.label, chip.value);
                      
                      return (
                        <button
                          key={`${chip.value}-${index}`}
                          onClick={() => handleChipClick(chip)}
                          className="flex items-center gap-3 bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-3.5 text-sm font-medium text-gray-700 hover:bg-white hover:shadow-lg transition-all active:scale-[0.98] shadow-md border border-gray-100"
                          style={{
                            animation: `chipSlide 0.3s ease-out ${index * 0.08}s both`
                          }}
                        >
                          <IconComponent className="w-5 h-5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                          <span className="text-gray-600 text-right flex-1 text-xs leading-tight">{chip.label}</span>
                        </button>
                      );
                    })}
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
