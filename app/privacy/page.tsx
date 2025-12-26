'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f9e7ff] to-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-gray-600 hover:text-[#C5459C] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back</span>
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <h1 className="text-5xl font-black bg-gradient-to-r from-[#E91E8C] to-[#A855C7] bg-clip-text text-transparent mb-3">
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-500">Last updated: December 26, 2025</p>
          </div>
          
          <p className="text-gray-700 text-center text-lg">
            We are committed to protecting your privacy and ensuring you have a positive experience on Pachu.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">📊</span> Information We Collect
            </h2>
            
            <div className="space-y-4 ml-8">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Personal Information</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Name and username</li>
                  <li>Email address</li>
                  <li>Profile photo (optional)</li>
                  <li>Authentication credentials</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Content You Share</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Restaurant reviews and ratings</li>
                  <li>Photos and videos</li>
                  <li>Comments and interactions</li>
                  <li>Location data (with your permission)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Usage Information</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Device information and IP address</li>
                  <li>Browser type and version</li>
                  <li>Pages visited and features used</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">🎯</span> How We Use Your Information
            </h2>
            <ul className="list-disc pl-14 text-gray-700 space-y-2">
              <li>Provide and improve our services</li>
              <li>Personalize your experience</li>
              <li>Connect you with friends and other users</li>
              <li>Show relevant restaurant recommendations</li>
              <li>Send you notifications about activity</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">🤝</span> Information Sharing
            </h2>
            <p className="text-gray-700 mb-3 ml-8">We do not sell your personal information. We may share information:</p>
            <ul className="list-disc pl-14 text-gray-700 space-y-2">
              <li><strong>Publicly:</strong> Your reviews, ratings, and profile information are visible to other users</li>
              <li><strong>With Service Providers:</strong> Third-party services that help us operate</li>
              <li><strong>For Legal Reasons:</strong> When required by law</li>
              <li><strong>With Your Consent:</strong> When you explicitly agree</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">⚙️</span> Your Rights and Choices
            </h2>
            <ul className="list-disc pl-14 text-gray-700 space-y-2">
              <li>Access and update your personal information</li>
              <li>Delete your account and associated data</li>
              <li>Control your privacy settings</li>
              <li>Opt-out of marketing communications</li>
              <li>Request a copy of your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">🔒</span> Data Security
            </h2>
            <p className="text-gray-700 ml-8">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">🍪</span> Cookies and Tracking
            </h2>
            <p className="text-gray-700 ml-8">
              We use cookies and similar technologies to enhance your experience, analyze usage, and personalize content. You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">🔗</span> Third-Party Services
            </h2>
            <p className="text-gray-700 mb-3 ml-8">Our app uses third-party services including:</p>
            <ul className="list-disc pl-14 text-gray-700 space-y-1">
              <li>Google (for authentication and maps)</li>
              <li>Supabase (for database and authentication)</li>
              <li>Mapbox (for map services)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">👶</span> Children's Privacy
            </h2>
            <p className="text-gray-700 ml-8">
              Our service is not intended for users under 13 years of age. We do not knowingly collect information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">📧</span> Contact Us
            </h2>
            <p className="text-gray-700 ml-8">
              If you have questions about this Privacy Policy, please contact us at:{' '}
              <a href="mailto:donotreply@pachu.app" className="text-[#C5459C] font-semibold hover:underline">
                donotreply@pachu.app
              </a>
            </p>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center">
          <Link href="/terms" className="text-[#C5459C] hover:text-[#A855C7] font-medium transition-colors">
            View Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}
