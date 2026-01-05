'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Database, Filter, Sparkles, BarChart3, Trophy, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface PipelineStep {
  title: string;
  icon: React.ReactNode;
  count: number;
  percentage: number;
  color: string;
  data: any;
}

interface DebugData {
  step1: {
    totalInDb: number;
    afterFilter: number;
    sampleRestaurants: any[];
  };
  step2: {
    queryText: string;
    totalScored: number;
    topByVector: any[];
  };
  step3: {
    totalReranked: number;
    topByRerank: any[];
  };
  step4: {
    candidatesSentToLLM: any[];
    finalRecommendations: any[];
  };
}

export default function PipelineAnalyticsPage() {
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [testContext, setTestContext] = useState({
    occasion: 'friends',
    location: 'walking',
    cuisine: '',
  });

  // Check access on mount
  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const response = await fetch('/api/admin/check-access');
      const data = await response.json();
      setHasAccess(data.hasAccess);
    } catch {
      setHasAccess(false);
    }
  };

  const runPipelineAnalysis = async () => {
    setIsLoading(true);
    setDebugData(null);

    try {
      const response = await fetch('/api/agent/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            where: testContext.location === 'walking' ? 'walking_distance' : 
                   testContext.location === 'travel' ? 'willing_to_travel' : 'tel_aviv',
            withWho: testContext.occasion,
            purpose: testContext.occasion === 'date' ? 'romantic_dinner' : 'casual_meal',
            budget: null,
            when: null,
            cuisinePreference: testContext.cuisine || null,
          },
          userLocation: { lat: 32.0853, lng: 34.7818 },
          conversationSummary: `Looking for ${testContext.cuisine || 'food'} with ${testContext.occasion}`,
          includeDebugData: true,
        }),
      });

      const data = await response.json();
      if (data.debugData) {
        setDebugData(data.debugData);
      }
    } catch (error) {
      console.error('Pipeline analysis error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Access check loading
  if (hasAccess === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // No access
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">This feature is only available for developers.</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-primary text-white rounded-full"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const steps: PipelineStep[] = debugData ? [
    {
      title: 'Database',
      icon: <Database className="w-5 h-5" />,
      count: debugData.step1?.totalInDb || 0,
      percentage: 100,
      color: 'bg-blue-500',
      data: debugData.step1,
    },
    {
      title: 'SQL Filters',
      icon: <Filter className="w-5 h-5" />,
      count: debugData.step1?.afterFilter || 0,
      percentage: debugData.step1 ? Math.round((debugData.step1.afterFilter / debugData.step1.totalInDb) * 100) : 0,
      color: 'bg-purple-500',
      data: debugData.step1,
    },
    {
      title: 'Vector Search',
      icon: <Sparkles className="w-5 h-5" />,
      count: debugData.step2?.totalScored || 0,
      percentage: debugData.step2 && debugData.step1 ? Math.round((debugData.step2.totalScored / debugData.step1.afterFilter) * 100) : 0,
      color: 'bg-pink-500',
      data: debugData.step2,
    },
    {
      title: 'Re-ranking',
      icon: <BarChart3 className="w-5 h-5" />,
      count: debugData.step3?.topByRerank?.length || 0,
      percentage: 100,
      color: 'bg-orange-500',
      data: debugData.step3,
    },
    {
      title: 'Sent to LLM',
      icon: <Sparkles className="w-5 h-5" />,
      count: debugData.step4?.candidatesSentToLLM?.length || 0,
      percentage: debugData.step4 && debugData.step3 ? Math.round((debugData.step4.candidatesSentToLLM.length / Math.min(debugData.step3.topByRerank?.length || 15, 15)) * 100) : 0,
      color: 'bg-indigo-500',
      data: debugData.step4?.candidatesSentToLLM,
    },
    {
      title: 'Final Results',
      icon: <Trophy className="w-5 h-5" />,
      count: debugData.step4?.finalRecommendations?.length || 0,
      percentage: 100,
      color: 'bg-green-500',
      data: debugData.step4?.finalRecommendations,
    },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900">Pipeline Analytics</h1>
            <p className="text-xs text-gray-500">Developer tools</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Test Parameters */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-3">Test Parameters</h2>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Occasion</label>
              <select
                value={testContext.occasion}
                onChange={(e) => setTestContext(prev => ({ ...prev, occasion: e.target.value }))}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="date">Date 💕</option>
                <option value="friends">Friends 👥</option>
                <option value="family">Family 👨‍👩‍👧</option>
                <option value="solo">Solo 🧘</option>
                <option value="work">Work 💼</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Location</label>
              <select
                value={testContext.location}
                onChange={(e) => setTestContext(prev => ({ ...prev, location: e.target.value }))}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="walking">Walking Distance 🚶</option>
                <option value="travel">Willing to Travel 🚗</option>
                <option value="tel_aviv">All Tel Aviv 🏙️</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-1 block">Cuisine (optional)</label>
              <input
                type="text"
                value={testContext.cuisine}
                onChange={(e) => setTestContext(prev => ({ ...prev, cuisine: e.target.value }))}
                placeholder="e.g., Italian, Asian..."
                className="w-full p-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>

            <button
              onClick={runPipelineAnalysis}
              disabled={isLoading}
              className="w-full py-3 bg-primary text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Pipeline...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  Run Pipeline Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pipeline Visualization */}
        {debugData && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900">Pipeline Flow</h2>
            
            {/* Visual Flow */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between overflow-x-auto pb-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[60px]">
                      <div className={`w-10 h-10 ${step.color} rounded-full flex items-center justify-center text-white`}>
                        {step.icon}
                      </div>
                      <span className="text-lg font-bold text-gray-900 mt-1">{step.count.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-500 text-center">{step.title}</span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className="w-6 h-0.5 bg-gray-300 mx-1" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Details */}
            {steps.map((step, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedStep(expandedStep === index ? null : index)}
                  className="w-full p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${step.color} rounded-full flex items-center justify-center text-white`}>
                      {step.icon}
                    </div>
                    <div className="text-left">
                      <span className="font-medium text-gray-900">{step.title}</span>
                      <span className="text-sm text-gray-500 ml-2">({step.count.toLocaleString()} items)</span>
                    </div>
                  </div>
                  {expandedStep === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>

                {expandedStep === index && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <StepDetails step={step} index={index} debugData={debugData} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepDetails({ step, index, debugData }: { step: PipelineStep; index: number; debugData: DebugData }) {
  if (index === 0) {
    // Database total
    return (
      <div className="pt-3 space-y-2">
        <p className="text-sm text-gray-600">
          Total restaurants in database: <span className="font-bold text-gray-900">{debugData.step1?.totalInDb?.toLocaleString()}</span>
        </p>
      </div>
    );
  }

  if (index === 1) {
    // SQL Filters
    return (
      <div className="pt-3 space-y-3">
        <p className="text-sm text-gray-600">
          After location & filters: <span className="font-bold text-gray-900">{debugData.step1?.afterFilter}</span>
        </p>
        <div className="text-xs text-gray-500">Sample restaurants:</div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {debugData.step1?.sampleRestaurants?.map((r: any, i: number) => (
            <div key={i} className="p-2 bg-gray-50 rounded-lg text-sm">
              <div className="font-medium text-gray-900">{r.name}</div>
              <div className="text-xs text-gray-500">
                {r.city} • {r.distance ? `${(r.distance / 1000).toFixed(1)}km` : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (index === 2) {
    // Vector Search
    return (
      <div className="pt-3 space-y-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <div className="text-xs text-blue-600 font-medium">Query Text:</div>
          <div className="text-sm text-blue-900">{debugData.step2?.queryText}</div>
        </div>
        <div className="text-xs text-gray-500">Top by vector similarity:</div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {debugData.step2?.topByVector?.map((r: any, i: number) => (
            <div key={i} className="p-2 bg-gray-50 rounded-lg text-sm flex justify-between">
              <div>
                <div className="font-medium text-gray-900">{r.name}</div>
                <div className="text-xs text-gray-500">{r.categories?.slice(0, 2).join(', ')}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-purple-600">{r.vectorScore?.toFixed(3)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (index === 3) {
    // Re-ranking
    return (
      <div className="pt-3 space-y-3">
        <div className="text-xs text-gray-500">Top after re-ranking (vector + social signals):</div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {debugData.step3?.topByRerank?.map((r: any, i: number) => (
            <div key={i} className="p-2 bg-gray-50 rounded-lg text-sm">
              <div className="flex justify-between">
                <div className="font-medium text-gray-900">{r.name}</div>
                <div className="font-mono text-xs text-green-600">{r.finalScore?.toFixed(3)}</div>
              </div>
              <div className="flex gap-3 text-xs text-gray-500 mt-1">
                <span>Vector: {r.vectorScore?.toFixed(3)}</span>
                <span>Social: {r.socialScore?.toFixed(3)}</span>
                <span>⭐ {r.googleRating}</span>
                <span>({r.reviewCount})</span>
              </div>
              {r.friendsWhoVisited?.length > 0 && (
                <div className="text-xs text-primary mt-1">
                  👥 Friends: {r.friendsWhoVisited.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (index === 4) {
    // Sent to LLM
    return (
      <div className="pt-3 space-y-3">
        <div className="text-xs text-gray-500">15 candidates sent to LLM for final selection:</div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {debugData.step4?.candidatesSentToLLM?.map((r: any, i: number) => (
            <div key={i} className="p-2 bg-gray-50 rounded-lg text-sm">
              <div className="flex justify-between">
                <div className="font-medium text-gray-900">{i + 1}. {r.name}</div>
                <div className="font-mono text-xs text-indigo-600">{r.finalScore?.toFixed(3)}</div>
              </div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{r.summary}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (index === 5) {
    // Final Results
    return (
      <div className="pt-3 space-y-3">
        <div className="text-xs text-gray-500">Final 3 recommendations with LLM reasons:</div>
        <div className="space-y-3">
          {debugData.step4?.finalRecommendations?.map((r: any, i: number) => (
            <div key={i} className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex justify-between items-start">
                <div className="font-bold text-gray-900">{i + 1}. {r.name}</div>
                <div className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                  {r.matchScore}%
                </div>
              </div>
              <div className="text-sm text-gray-700 mt-2">{r.reason}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
