import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to feed
  redirect('/feed');
}

