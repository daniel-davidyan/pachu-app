export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <p className="text-sm text-gray-500 mb-4">Last updated: December 26, 2025</p>
            <p className="mb-4">
              Welcome to Pachu ("we," "our," or "us"). We are committed to protecting your privacy and ensuring you have a positive experience on our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Personal Information</h3>
            <p className="mb-4">When you create an account, we collect:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Name and username</li>
              <li>Email address</li>
              <li>Profile photo (optional)</li>
              <li>Authentication credentials</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">Content You Share</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Restaurant reviews and ratings</li>
              <li>Photos and videos</li>
              <li>Comments and interactions</li>
              <li>Location data (with your permission)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">Usage Information</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Device information</li>
              <li>IP address</li>
              <li>Browser type</li>
              <li>Pages visited and features used</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
            <p className="mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Provide and improve our services</li>
              <li>Personalize your experience</li>
              <li>Connect you with friends and other users</li>
              <li>Show relevant restaurant recommendations</li>
              <li>Send you notifications about activity on your account</li>
              <li>Communicate with you about updates and features</li>
              <li>Ensure security and prevent fraud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information Sharing</h2>
            <p className="mb-4">We do not sell your personal information. We may share information:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li><strong>Publicly:</strong> Your reviews, ratings, and profile information are visible to other users</li>
              <li><strong>With Service Providers:</strong> Third-party services that help us operate (e.g., hosting, analytics)</li>
              <li><strong>For Legal Reasons:</strong> When required by law or to protect rights and safety</li>
              <li><strong>With Your Consent:</strong> When you explicitly agree to share information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights and Choices</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Access and update your personal information</li>
              <li>Delete your account and associated data</li>
              <li>Control your privacy settings</li>
              <li>Opt-out of marketing communications</li>
              <li>Request a copy of your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security</h2>
            <p className="mb-4">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar technologies to enhance your experience, analyze usage, and personalize content. You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="mb-4">
              Our app uses third-party services including:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Google (for authentication and maps)</li>
              <li>Supabase (for database and authentication)</li>
              <li>Mapbox (for map services)</li>
            </ul>
            <p className="mb-4">
              These services have their own privacy policies governing the use of your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
            <p className="mb-4">
              Our service is not intended for users under 13 years of age. We do not knowingly collect information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
            <p className="mb-4">
              We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="mb-4">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mb-2">
              <strong>Email:</strong> <a href="mailto:danieldadyan@pachu.app" className="text-[#C5459C] hover:underline">noreply@pachu.app</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

