import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8 bg-[#f9e7ff]">
      <div className="text-center">
        <h1 className="text-6xl font-black bg-gradient-to-r from-[#E91E8C] to-[#A855C7] bg-clip-text text-transparent mb-4">
          Pachu
        </h1>
        <p className="text-2xl font-medium bg-gradient-to-r from-[#E91E8C] to-[#A855C7] bg-clip-text text-transparent mb-8">
          The Taste Signature
        </p>
        <div className="space-y-4">
          <Link href="/auth/login" className="block px-8 py-3 bg-[#C5459C] text-white rounded-lg font-semibold hover:bg-[#A855C7] transition-colors">
            Get Started
          </Link>
        </div>
        <div className="mt-12 text-sm text-gray-600">
          <Link href="/privacy" className="hover:text-[#C5459C] transition-colors underline">
            Privacy Policy
          </Link>
          {' • '}
          <Link href="/terms" className="hover:text-[#C5459C] transition-colors underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}

