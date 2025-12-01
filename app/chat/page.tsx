'use client';

import { MainLayout } from '@/components/layout/main-layout';


export default function ChatPage() {
  

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 h-[calc(100vh-120px)] flex flex-col">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">AI Recommender</h1>
        
        {/* Chat Messages Area */}
        <div className="flex-1 bg-white rounded-lg shadow p-4 mb-4 overflow-y-auto">
          <div className="text-center text-gray-500 mt-10">
            <p>AI Chat coming soon...</p>
            <p className="text-sm mt-2">Chat with AI to get personalized restaurant recommendations</p>
          </div>
        </div>

        {/* Chat Input */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Tell me what you're craving..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
              disabled
            />
            <button className="px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary-600 transition-colors" disabled>
              Send
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

