'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, Loader2, GripVertical, MapPin, ChevronUp } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Array<{ id: string; name: string; }>;
}

interface AIChatPanelV2Props {
  onFilterChange?: (filters: RestaurantFilters) => void;
  onRestaurantsFound?: (restaurants: Array<{ id: string; name: string; }>) => void;
  matchedCount?: number;
  userLocation?: { lat: number; lng: number } | null;
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

type ChatState = 'collapsed' | 'fullscreen' | 'split';

export function AIChatPanelV2({ onFilterChange, onRestaurantsFound, matchedCount = 0, userLocation }: AIChatPanelV2Props) {
  const [chatState, setChatState] = useState<ChatState>('collapsed');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // Percentage for map (top)
  const [isDragging, setIsDragging] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartRatio = useRef(50);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle divider drag
  const handleDividerDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (chatState !== 'split') return;
    setIsDragging(true);
    dragStartRatio.current = splitRatio;
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const windowHeight = window.innerHeight;
      const deltaY = currentY - dragStartY.current;
      const deltaPercent = (deltaY / windowHeight) * 100;
      
      // Calculate new ratio (map percentage)
      let newRatio = dragStartRatio.current + deltaPercent;
      
      // Constrain between 30% and 70%
      newRatio = Math.max(30, Math.min(70, newRatio));
      
      setSplitRatio(newRatio);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  const handleExpand = () => {
    setChatState('fullscreen');
    // Initialize conversation if empty
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "Hi! I'm your personal restaurant finder 🍽️\n\nTo help you find the perfect spot, let me ask you a few quick questions:\n\n1️⃣ What type of cuisine are you in the mood for?\n2️⃣ What's your budget today?\n3️⃣ Any special preferences? (romantic, family-friendly, outdoor seating, etc.)"
      }]);
    }
  };

  const handleClose = () => {
    setChatState('collapsed');
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build conversation history for API
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
          location: userLocation || { lat: 32.0853, lng: 34.7818 } // Default to Tel Aviv if no location
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

      // If AI found restaurants, switch to split view
      if (data.restaurants && data.restaurants.length > 0) {
        setChatState('split');
        onRestaurantsFound?.(data.restaurants);
      }

      // Update filters if provided
      if (data.filters) {
        onFilterChange?.(data.filters);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Let me help you find restaurants based on your location! 📍"
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Collapsed State
  if (chatState === 'collapsed') {
    return (
      <button
        onClick={handleExpand}
        className="fixed bottom-[72px] left-3 right-3 z-40 bg-gradient-to-r from-primary to-primary/90 text-white rounded-full px-6 py-4 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">Ask AI to find restaurants</p>
            <p className="text-xs text-white/80">Tell me what you&apos;re craving...</p>
          </div>
        </div>
        <ChevronUp className="w-5 h-5 group-hover:translate-y-[-2px] transition-transform" />
      </button>
    );
  }

  // Full Screen State
  if (chatState === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">AI Restaurant Finder</h2>
              <p className="text-xs text-gray-500">Powered by GPT-4</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.restaurants && message.restaurants.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {message.restaurants.length} restaurants found on map
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 px-4 py-3 bg-white">
          <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 focus-within:border-primary transition-colors">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your answer..."
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400"
              autoFocus
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Split View State
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Map Area (Top) */}
      <div 
        className="bg-transparent pointer-events-none"
        style={{ height: `${splitRatio}%` }}
      />

      {/* Draggable Divider */}
      <div
        className="relative z-50 h-1 bg-gray-300 hover:bg-primary transition-colors cursor-ns-resize group"
        onMouseDown={handleDividerDragStart}
        onTouchStart={handleDividerDragStart}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-5 bg-white border-2 border-gray-300 group-hover:border-primary rounded-full flex items-center justify-center shadow-lg transition-colors">
          <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-primary" />
        </div>
      </div>

      {/* Chat Area (Bottom) */}
      <div 
        className="bg-white flex flex-col border-t-2 border-gray-200"
        style={{ height: `${100 - splitRatio}%` }}
      >
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm text-gray-900">AI Suggestions</span>
            {matchedCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {matchedCount} places
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center bg-white hover:bg-gray-100 rounded-full transition-colors border border-gray-200"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-md">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 px-3 py-2 bg-white flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-primary transition-colors">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask me anything..."
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

