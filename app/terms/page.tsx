'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-sm text-gray-500">Last updated: December 26, 2025</p>
          </div>
          
          <p className="text-gray-700 text-center text-lg">
            By using Pachu, you agree to these Terms of Service. Please read them carefully.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-8">
          
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">✅</span> Acceptance of Terms
            </h2>
            <p className="text-gray-700 mb-3 ml-8">By creating an account or using Pachu, you confirm that you:</p>
            <ul className="list-disc pl-14 text-gray-700 space-y-2">
              <li>Are at least 13 years old</li>
              <li>Have the legal capacity to enter into these Terms</li>
              <li>Will comply with these Terms and all applicable laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">👤</span> User Accounts
            </h2>
            
            <div className="ml-8 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Creation</h3>
                <p className="text-gray-700 mb-2">You agree to:</p>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Provide accurate and complete information</li>
                  <li>Keep your password secure and confidential</li>
                  <li>Notify us immediately of any unauthorized access</li>
                  <li>Be responsible for all activity under your account</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Account Termination</h3>
                <p className="text-gray-700">
                  We reserve the right to suspend or terminate your account if you violate these Terms or engage in harmful behavior.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">📝</span> User Content & Reviews
            </h2>
            
            <div className="ml-8 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Content Ownership</h3>
                <p className="text-gray-700">
                  You retain ownership of your content. By posting, you grant Pachu a license to use, display, and distribute it.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Content Guidelines - Do NOT Post:</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>False, misleading, or fraudulent content</li>
                  <li>Content violating intellectual property rights</li>
                  <li>Hate speech, harassment, or threats</li>
                  <li>Sexually explicit or violent content</li>
                  <li>Spam or unsolicited advertising</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Review Guidelines</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Share your genuine, personal experience</li>
                  <li>Be honest and fair in your ratings</li>
                  <li>Do not post fake or biased reviews</li>
                  <li>Do not accept compensation for reviews</li>
                  <li>Respect restaurant staff and other diners</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">🚫</span> Prohibited Conduct
            </h2>
            <p className="text-gray-700 mb-3 ml-8">You may not:</p>
            <ul className="list-disc pl-14 text-gray-700 space-y-2">
              <li>Use automated systems (bots, scrapers) to access the Services</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Services</li>
              <li>Impersonate another person or entity</li>
              <li>Collect personal data about other users</li>
              <li>Use the Services for any illegal purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">©️</span> Intellectual Property
            </h2>
            <p className="text-gray-700 ml-8">
              The Pachu name, logo, and all related marks are trademarks of Pachu. The Services and their original content are protected by copyright and trademark laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">⚠️</span> Disclaimers & Liability
            </h2>
            <div className="ml-8 space-y-3">
              <p className="text-gray-700">
                <strong>THE SERVICES ARE PROVIDED "AS IS" WITHOUT WARRANTIES.</strong> We do not guarantee that:
              </p>
              <ul className="list-disc pl-6 text-gray-700 space-y-1">
                <li>The Services will be uninterrupted or error-free</li>
                <li>User-generated content is accurate or reliable</li>
                <li>Defects will be corrected</li>
              </ul>
              <p className="text-gray-700">
                <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW</strong>, Pachu shall not be liable for any indirect, incidental, or consequential damages.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">🔄</span> Changes to Terms
            </h2>
            <p className="text-gray-700 ml-8">
              We may modify these Terms at any time. Your continued use after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-[#C5459C]">📧</span> Contact Information
            </h2>
            <p className="text-gray-700 ml-8">
              If you have questions about these Terms, please contact us at:{' '}
              <a href="mailto:danieldadyan@pachu.app" className="text-[#C5459C] font-semibold hover:underline">
                danieldadyan@pachu.app
              </a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-3">
          <Link href="/privacy" className="block text-[#C5459C] hover:text-[#A855C7] font-medium transition-colors">
            ← View Privacy Policy
          </Link>
          <p className="text-sm text-gray-600">
            By using Pachu, you acknowledge that you have read and agree to these Terms of Service.
          </p>
        </div>
      </div>
    </div>
  );
}
