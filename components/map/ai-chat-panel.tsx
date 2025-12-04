'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, GripHorizontal, Sparkles, MapPin, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

interface AIChatPanelProps {
  onFilterChange?: (filters: RestaurantFilters) => void;
  matchedCount?: number;
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

export function AIChatPanel({ onFilterChange, matchedCount = 0 }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your food finder 🍽️ Tell me what you're in the mood for, and I'll help you find the perfect spot!",
      suggestions: ['Romantic dinner', 'Cheap eats', 'Coffee & work', 'Family friendly']
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [panelHeight, setPanelHeight] = useState(180); // Starting height
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const minHeight = 80;
  const maxHeight = typeof window !== 'undefined' ? window.innerHeight * 0.7 : 500;

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle drag start
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    dragStartHeight.current = panelHeight;
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
  };

  // Handle drag move
  useEffect(() => {
    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (!isDragging) return;
      
      const currentY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const diff = dragStartY.current - currentY;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, dragStartHeight.current + diff));
      setPanelHeight(newHeight);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, maxHeight]);

  const [currentFilters, setCurrentFilters] = useState<RestaurantFilters>({ query: '' });

  const handleSend = async (text: string = inputValue) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setPanelHeight(Math.max(panelHeight, 300)); // Expand panel when chatting

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
          message: text,
          conversationHistory,
          currentFilters
        })
      });

      const data = await response.json();

      if (data.error) {
        // Fallback to local response if API fails
        const filters = extractFiltersLocal(text);
        setCurrentFilters(filters);
        onFilterChange?.(filters);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: generateLocalResponse(text),
          suggestions: data.suggestions || generateLocalSuggestions(filters)
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Use AI response
        const newFilters = { ...currentFilters, ...data.filters, query: text };
        setCurrentFilters(newFilters);
        onFilterChange?.(newFilters);

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          suggestions: data.suggestions
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Fallback response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting. Let me help you locally! What type of food are you craving? 🍽️",
        suggestions: ['Italian', 'Asian', 'Budget-friendly', 'Romantic']
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback local filter extraction
  const extractFiltersLocal = (text: string): RestaurantFilters => {
    const lowerText = text.toLowerCase();
    const filters: RestaurantFilters = { ...currentFilters, query: text };

    if (lowerText.includes('cheap') || lowerText.includes('budget')) {
      filters.priceLevel = [1, 2];
    } else if (lowerText.includes('expensive') || lowerText.includes('upscale')) {
      filters.priceLevel = [3, 4];
    }
    if (lowerText.includes('romantic') || lowerText.includes('date')) {
      filters.romantic = true;
    }
    if (lowerText.includes('dog') || lowerText.includes('pet')) {
      filters.petFriendly = true;
    }
    if (lowerText.includes('outdoor')) {
      filters.outdoor = true;
    }

    return filters;
  };

  const generateLocalResponse = (text: string): string => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('romantic')) return "Perfect for a date! 💕 I've filtered to romantic spots.";
    if (lowerText.includes('cheap')) return "Budget-friendly options coming up! 💰";
    if (lowerText.includes('pet') || lowerText.includes('dog')) return "Pet-friendly places for you and your furry friend! 🐕";
    return "Got it! I've updated the map. Anything else? 🗺️";
  };

  const generateLocalSuggestions = (filters: RestaurantFilters): string[] => {
    const suggestions: string[] = [];
    if (!filters.priceLevel) suggestions.push('Budget-friendly', 'Upscale');
    if (!filters.romantic) suggestions.push('Romantic');
    if (!filters.petFriendly) suggestions.push('Pet-friendly');
    if (!filters.outdoor) suggestions.push('Outdoor');
    return suggestions.slice(0, 4);
  };

  return (
    <div 
      ref={panelRef}
      className="fixed bottom-[72px] left-3 right-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] border border-gray-200/50 z-40 transition-all duration-100"
      style={{ height: panelHeight }}
    >
      {/* Drag Handle */}
      <div 
        className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-6 h-6 text-gray-400" />
          {matchedCount > 0 && (
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
              <MapPin className="w-3 h-3 inline mr-1" />
              {matchedCount} places
            </span>
          )}
        </div>
      </div>

      {/* Chat Content */}
      <div className="flex flex-col h-[calc(100%-48px)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">
          {messages.map((message) => (
            <div key={message.id}>
              <div
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-900 rounded-bl-md'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <Sparkles className="w-4 h-4 inline mr-1 text-primary" />
                  )}
                  {message.content}
                </div>
              </div>
              
              {/* Suggestion Chips */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 ml-2">
                  {message.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(suggestion)}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-full text-gray-700 hover:border-primary hover:text-primary transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
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

        {/* Input */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="What are you craving?"
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading}
              className="w-9 h-9 flex items-center justify-center bg-primary text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

