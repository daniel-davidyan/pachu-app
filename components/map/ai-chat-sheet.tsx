'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, ChevronDown, Plus, Clock, X, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Array<{ id: string; name: string; }>;
}

interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

interface AIChatSheetProps {
  onFilterChange?: (filters: RestaurantFilters) => void;
  onRestaurantsFound?: (restaurants: Array<{ id: string; name: string; }>) => void;
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

export function AIChatSheet({ onFilterChange, onRestaurantsFound, matchedCount = 0, userLocation, onChatStateChange }: AIChatSheetProps) {
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
  
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const updated = [conversation, ...filtered].slice(0, 20); // Keep max 20 conversations
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
    setSheetHeight(200);
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
        content: "Hi! 🍽️ What type of cuisine are you in the mood for?"
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
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Auto-expand if small
    if (!isActive || sheetHeight < 300) {
      setIsActive(true);
      setSheetHeight(400);
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

  // If not active, show only floating search bar (positioned above nav-bar)
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
            placeholder="Search restaurants..."
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

  // Active pane with conversation - extends to bottom with padding
  return (
    <div
      ref={sheetRef}
      className="fixed z-40 bg-gradient-to-b from-gray-50 to-white rounded-2xl shadow-2xl border border-gray-200 transition-all duration-200 ease-out overflow-hidden"
      style={{ 
        bottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        left: 'max(0.75rem, env(safe-area-inset-left))',
        right: 'max(0.75rem, env(safe-area-inset-right))',
        height: sheetHeight,
        maxHeight: maxHeight,
      }}
    >
      {/* Drag Handle */}
      <div
        className="flex flex-col items-center pt-2 pb-2 cursor-grab active:cursor-grabbing touch-none bg-white/50"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
      </div>

      {/* Content */}
      <div className="flex flex-col h-[calc(100%-24px)] px-4 pb-3">
        
        {/* History View */}
        {showHistory ? (
          <>
            {/* History Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5 text-white" strokeWidth={2} />
                </div>
                <h2 className="font-bold text-gray-900 text-sm">Chat History</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-4.5 h-4.5 text-gray-600" strokeWidth={2.5} />
              </button>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-300">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="text-sm text-gray-500">No chat history yet</p>
                </div>
              ) : (
                chatHistory.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleLoadChat(chat)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer group ${
                      chat.id === currentChatId
                        ? 'bg-primary/5 border-primary shadow-sm'
                        : 'bg-white border-gray-200 hover:border-primary/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 truncate mb-1">
                          {chat.title}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(chat.timestamp).toLocaleDateString()} • {chat.messages.length} messages
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded-full"
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
                className="w-full py-2.5 px-4 bg-gradient-to-r from-primary to-primary/80 text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
                Start New Chat
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-sm">AI Restaurant Finder</h2>
                  {matchedCount > 0 && (
                    <p className="text-xs text-gray-500">{matchedCount} places found</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* New Chat Button */}
                <button
                  onClick={handleNewChat}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  title="New Chat"
                >
                  <Plus className="w-4.5 h-4.5 text-gray-600" strokeWidth={2.5} />
                </button>
                {/* History Button */}
                <button
                  onClick={() => {
                    setShowHistory(true);
                    setSheetHeight(500);
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                  title="Chat History"
                >
                  <Clock className="w-4.5 h-4.5 text-gray-600" strokeWidth={2} />
                </button>
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  <ChevronDown className="w-4.5 h-4.5 text-gray-600" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Find your perfect restaurant</h3>
                  <p className="text-xs text-gray-500">Tell me what you&apos;re craving...</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white shadow-sm border border-gray-100 px-3 py-2 rounded-2xl rounded-bl-md">
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
          </>
        )}
      </div>
    </div>
  );
}
