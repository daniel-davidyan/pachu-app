'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Filter, Sparkles, BarChart3, Trophy, ChevronDown, ChevronUp, MessageSquare, Loader2 } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  address?: string;
  city?: string;
  categories?: string[];
  vectorScore?: number;
  socialScore?: number;
  finalScore?: number;
  googleRating?: number;
  reviewCount?: number;
  distance?: number;
  friendsWhoVisited?: string[];
  summary?: string;
  matchScore?: number;
  reason?: string;
}

interface DebugData {
  step1: {
    totalInDb: number;
    afterFilter: number;
    sampleRestaurants: Restaurant[];
  };
  step2: {
    queryText: string;
    totalScored: number;
    topByVector: Restaurant[];
  };
  step3: {
    totalReranked: number;
    topByRerank: Restaurant[];
  };
  step4: {
    candidatesSentToLLM: Restaurant[];
    finalRecommendations: Restaurant[];
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  restaurants?: Restaurant[];
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
}

interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  context?: ConversationContext;
  debugData?: DebugData; // Debug data from the actual conversation
}

const STORAGE_KEY = 'pachu-chat-history';

const ANALYTICS_PASSWORD = '166147';
const ACCESS_STORAGE_KEY = 'pachu-analytics-access';

export default function PipelineAnalyticsPage() {
  const router = useRouter();
  // Initialize access state lazily from localStorage
  const [hasAccess, setHasAccess] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ACCESS_STORAGE_KEY) === 'granted';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  // Initialize chat history lazily from localStorage
  const [chatHistory, setChatHistory] = useState<ChatConversation[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const history = JSON.parse(stored);
        console.log('📂 Loaded chat history:', history.map((c: ChatConversation) => ({
          id: c.id,
          title: c.title,
          hasDebugData: !!c.debugData
        })));
        return history;
      } catch (e) {
        console.error('Failed to load chat history', e);
        return [];
      }
    }
    return [];
  });
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = () => {
    if (passwordInput === ANALYTICS_PASSWORD) {
      localStorage.setItem(ACCESS_STORAGE_KEY, 'granted');
      setHasAccess(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const analyzeConversation = (chat: ChatConversation) => {
    console.log('📊 Analyzing conversation:', { 
      id: chat.id, 
      title: chat.title,
      hasDebugData: !!chat.debugData,
      debugDataKeys: chat.debugData ? Object.keys(chat.debugData) : null
    });
    
    setSelectedChat(chat);
    setError(null);

    // Use the stored debug data from the actual conversation - NO API CALL!
    if (chat.debugData) {
      console.log('✅ Using stored debug data from conversation');
      setDebugData(chat.debugData);
    } else {
      // No debug data stored - this is an old conversation before we added debug data
      console.log('❌ No debug data found for conversation');
      setError('לא נמצא מידע על הפייפליין לשיחה הזו. נסה שיחה חדשה עם האייג\'נט.');
      setDebugData(null);
    }
  };

  // No access - show password prompt
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2 text-center">Pipeline Analytics</h1>
          <p className="text-gray-600 mb-4 text-center text-sm">הכנס סיסמא כדי לצפות בנתונים</p>
          
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            placeholder="סיסמא"
            className={`w-full px-4 py-3 border rounded-xl text-center text-lg tracking-widest mb-3 ${
              passwordError ? 'border-red-500 bg-red-50' : 'border-gray-200'
            }`}
            autoFocus
          />
          
          {passwordError && (
            <p className="text-red-500 text-sm text-center mb-3">סיסמא שגויה</p>
          )}
          
          <button
            onClick={handlePasswordSubmit}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-medium"
          >
            כניסה
          </button>
          
          <button
            onClick={() => router.back()}
            className="w-full py-2 text-gray-500 text-sm mt-3"
          >
            חזרה
          </button>
        </div>
      </div>
    );
  }

  const steps = debugData ? [
    {
      title: 'Database Total',
      icon: <Database className="w-5 h-5" />,
      count: debugData.step1?.totalInDb || 0,
      color: 'bg-blue-500',
    },
    {
      title: 'After Hard Filters',
      icon: <Filter className="w-5 h-5" />,
      count: debugData.step1?.afterFilter || 0,
      color: 'bg-purple-500',
    },
    {
      title: 'Vector Search',
      icon: <Sparkles className="w-5 h-5" />,
      count: debugData.step2?.totalScored || 0,
      color: 'bg-pink-500',
    },
    {
      title: 'Re-ranking',
      icon: <BarChart3 className="w-5 h-5" />,
      count: debugData.step3?.topByRerank?.length || 0,
      color: 'bg-orange-500',
    },
    {
      title: 'Sent to LLM',
      icon: <Sparkles className="w-5 h-5" />,
      count: debugData.step4?.candidatesSentToLLM?.length || 0,
      color: 'bg-indigo-500',
    },
    {
      title: 'Final Results',
      icon: <Trophy className="w-5 h-5" />,
      count: debugData.step4?.finalRecommendations?.length || 0,
      color: 'bg-green-500',
    },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - with safe area padding for mobile */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">Pipeline Analytics</h1>
            <p className="text-xs text-gray-500">Select a conversation to analyze</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Conversation Selection */}
        {!selectedChat && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900">Recent Conversations</h2>
            
            {chatHistory.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center shadow-sm">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No conversations yet</p>
                <p className="text-sm text-gray-400 mt-1">Start chatting with the agent first</p>
              </div>
            ) : (
              chatHistory.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => analyzeConversation(chat)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{chat.title}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(chat.timestamp).toLocaleDateString('he-IL')} · {chat.messages.length} messages
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {chat.messages
                          .filter(m => m.restaurants && m.restaurants.length > 0)
                          .slice(-1)
                          .map(m => (
                            <span key={m.id} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              {m.restaurants?.length} recommendations
                            </span>
                          ))}
                      </div>
                    </div>
                    <ChevronDown className="w-5 h-5 text-gray-400 transform -rotate-90" />
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setSelectedChat(null);
              }}
              className="mt-3 text-sm text-red-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Pipeline Results */}
        {debugData && selectedChat && (
          <div className="space-y-4">
            {/* Selected Chat Info */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedChat.title}</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedChat.timestamp).toLocaleString('he-IL')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedChat(null);
                    setDebugData(null);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Choose another
                </button>
              </div>
            </div>

            {/* Query Text */}
            {debugData.step2?.queryText && (
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-blue-600 font-medium mb-1">Query sent to vector search:</p>
                <p className="text-sm text-blue-900">{debugData.step2.queryText}</p>
              </div>
            )}

            {/* Visual Flow */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Pipeline Flow</h3>
              <div className="flex items-center justify-between overflow-x-auto pb-2 gap-1">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[50px]">
                      <div className={`w-9 h-9 ${step.color} rounded-full flex items-center justify-center text-white`}>
                        {step.icon}
                      </div>
                      <span className="text-base font-bold text-gray-900 mt-1">{step.count.toLocaleString()}</span>
                      <span className="text-[9px] text-gray-500 text-center leading-tight">{step.title}</span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="w-4 h-0.5 bg-gray-300 mx-0.5" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Details - ALL RESTAURANTS */}
            <StepCard 
              title="1. Hard Filters (SQL)" 
              subtitle={`${debugData.step1?.afterFilter || 0} passed from ${debugData.step1?.totalInDb || 0}`}
              color="bg-purple-500"
              icon={<Filter className="w-5 h-5" />}
              isExpanded={expandedStep === 1}
              onToggle={() => setExpandedStep(expandedStep === 1 ? null : 1)}
            >
              <RestaurantList 
                restaurants={debugData.step1?.sampleRestaurants || []} 
                showDistance 
              />
            </StepCard>

            <StepCard 
              title="2. Vector Search" 
              subtitle={`${debugData.step2?.totalScored || 0} restaurants scored`}
              color="bg-pink-500"
              icon={<Sparkles className="w-5 h-5" />}
              isExpanded={expandedStep === 2}
              onToggle={() => setExpandedStep(expandedStep === 2 ? null : 2)}
            >
              <RestaurantList 
                restaurants={debugData.step2?.topByVector || []} 
                showVectorScore 
              />
            </StepCard>

            <StepCard 
              title="3. Re-ranking" 
              subtitle={`Top ${debugData.step3?.topByRerank?.length || 0} after social signals`}
              color="bg-orange-500"
              icon={<BarChart3 className="w-5 h-5" />}
              isExpanded={expandedStep === 3}
              onToggle={() => setExpandedStep(expandedStep === 3 ? null : 3)}
            >
              <RestaurantList 
                restaurants={debugData.step3?.topByRerank || []} 
                showAllScores 
              />
            </StepCard>

            <StepCard 
              title="4. Sent to LLM" 
              subtitle={`${debugData.step4?.candidatesSentToLLM?.length || 0} candidates`}
              color="bg-indigo-500"
              icon={<Sparkles className="w-5 h-5" />}
              isExpanded={expandedStep === 4}
              onToggle={() => setExpandedStep(expandedStep === 4 ? null : 4)}
            >
              <RestaurantList 
                restaurants={debugData.step4?.candidatesSentToLLM || []} 
                showSummary 
              />
            </StepCard>

            <StepCard 
              title="5. Final Recommendations" 
              subtitle={`${debugData.step4?.finalRecommendations?.length || 0} selected by LLM`}
              color="bg-green-500"
              icon={<Trophy className="w-5 h-5" />}
              isExpanded={expandedStep === 5}
              onToggle={() => setExpandedStep(expandedStep === 5 ? null : 5)}
            >
              <FinalRecommendations 
                recommendations={debugData.step4?.finalRecommendations || []} 
              />
            </StepCard>
          </div>
        )}
      </div>
    </div>
  );
}

// Step Card Component
function StepCard({ 
  title, 
  subtitle, 
  color, 
  icon, 
  isExpanded, 
  onToggle, 
  children 
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center text-white`}>
            {icon}
          </div>
          <div className="text-left">
            <span className="font-medium text-gray-900">{title}</span>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

// Restaurant List Component - shows ALL restaurants
function RestaurantList({ 
  restaurants, 
  showDistance = false,
  showVectorScore = false,
  showAllScores = false,
  showSummary = false,
}: {
  restaurants: Restaurant[];
  showDistance?: boolean;
  showVectorScore?: boolean;
  showAllScores?: boolean;
  showSummary?: boolean;
}) {
  if (restaurants.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No restaurants</p>;
  }

  return (
    <div className="space-y-2 pt-3">
      <p className="text-xs text-gray-500 mb-2">Showing all {restaurants.length} restaurants:</p>
      {restaurants.map((r, i) => (
        <div key={r.id || i} className="p-3 bg-gray-50 rounded-lg text-sm">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {i + 1}. {r.name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {r.city} {r.categories?.slice(0, 2).join(', ')}
              </p>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              {showDistance && r.distance && (
                <p className="text-xs text-blue-600">{(r.distance / 1000).toFixed(1)}km</p>
              )}
              {showVectorScore && r.vectorScore !== undefined && (
                <p className="font-mono text-xs text-purple-600">{r.vectorScore.toFixed(4)}</p>
              )}
              {showAllScores && (
                <div className="space-y-0.5">
                  <p className="font-mono text-xs text-green-600">Final: {r.finalScore?.toFixed(3)}</p>
                  <p className="font-mono text-xs text-gray-400">Vec: {r.vectorScore?.toFixed(3)}</p>
                  <p className="font-mono text-xs text-gray-400">Social: {r.socialScore?.toFixed(3)}</p>
                </div>
              )}
            </div>
          </div>
          {showAllScores && r.friendsWhoVisited && r.friendsWhoVisited.length > 0 && (
            <p className="text-xs text-primary mt-1">👥 {r.friendsWhoVisited.join(', ')}</p>
          )}
          {showSummary && r.summary && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.summary}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Final Recommendations Component
function FinalRecommendations({ recommendations }: { recommendations: Restaurant[] }) {
  if (recommendations.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No recommendations</p>;
  }

  return (
    <div className="space-y-3 pt-3">
      {recommendations.map((r, i) => (
        <div key={r.id || i} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="font-bold text-gray-900">{i + 1}. {r.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{r.categories?.slice(0, 3).join(', ')}</p>
            </div>
            {r.matchScore && (
              <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                {r.matchScore}%
              </span>
            )}
          </div>
          {r.reason && (
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">{r.reason}</p>
          )}
        </div>
      ))}
    </div>
  );
}
