'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  ArrowLeft, Star, MapPin, Calendar, ThumbsUp, UserPlus, UserCheck, 
  Loader2, Share2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import Link from 'next/link';

interface Review {
  id: string;
  rating: number;
  title?: string;
  content: string;
  visitDate?: string;
  createdAt: string;
  likesCount: number;
  isLiked: boolean;
  photos: string[];
  user: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  restaurant: {
    id: string;
    name: string;
    address?: string;
    imageUrl?: string;
    averageRating: number;
    totalReviews: number;
  } | null;
}

interface MutualFriend {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
}

interface RecentReview {
  id: string;
  rating: number;
  createdAt: string;
  restaurant: {
    id: string;
    name: string;
    imageUrl?: string;
  } | null;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  
  const reviewId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (reviewId) {
      fetchReview();
    }
  }, [reviewId]);

  const fetchReview = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/review/${reviewId}`);
      const data = await response.json();

      if (data.review) {
        setReview(data.review);
        setMutualFriends(data.mutualFriends || []);
        setRecentReviews(data.recentReviews || []);
        setIsFollowing(data.isFollowing || false);
      }
    } catch (error) {
      console.error('Error fetching review:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!review) return;
    
    // TODO: Implement like API call
    setReview({
      ...review,
      isLiked: !review.isLiked,
      likesCount: review.isLiked ? review.likesCount - 1 : review.likesCount + 1,
    });
  };

  const handleFollow = async () => {
    // TODO: Implement follow/unfollow API call
    setIsFollowing(!isFollowing);
  };

  const handleShare = async () => {
    if (navigator.share && review) {
      try {
        await navigator.share({
          title: `${review.user.fullName}'s review of ${review.restaurant?.name}`,
          text: review.content,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    }
  };

  const nextPhoto = () => {
    if (review && review.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === review.photos.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevPhoto = () => {
    if (review && review.photos.length > 0) {
      setCurrentPhotoIndex((prev) => 
        prev === 0 ? review.photos.length - 1 : prev - 1
      );
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!review) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <p className="text-gray-500 mb-4">Review not found</p>
          <button 
            onClick={() => router.back()}
            className="text-primary font-semibold"
          >
            Go Back
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 pb-20">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            
            <h1 className="font-bold text-lg text-gray-900">Review</h1>
            
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Review Photos Carousel */}
        {review.photos && review.photos.length > 0 && (
          <div className="relative bg-black">
            <div className="relative h-96">
              <img
                src={review.photos[currentPhotoIndex]}
                alt={`Review photo ${currentPhotoIndex + 1}`}
                className="w-full h-full object-contain"
                onClick={() => setShowFullImage(true)}
              />
              
              {review.photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                  
                  {/* Photo Counter */}
                  <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-medium">
                    {currentPhotoIndex + 1} / {review.photos.length}
                  </div>
                </>
              )}
            </div>
            
            {/* Photo Dots Indicator */}
            {review.photos.length > 1 && (
              <div className="flex justify-center gap-1.5 py-3 bg-black">
                {review.photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentPhotoIndex 
                        ? 'w-6 bg-white' 
                        : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Restaurant Info */}
        {review.restaurant && (
          <Link href={`/restaurant/${review.restaurant.id}`}>
            <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
              {review.restaurant.imageUrl ? (
                <img
                  src={review.restaurant.imageUrl}
                  alt={review.restaurant.name}
                  className="w-14 h-14 rounded-xl object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <span className="text-2xl">🍽️</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 truncate">{review.restaurant.name}</h2>
                {review.restaurant.address && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-500 truncate">{review.restaurant.address}</p>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                  <span className="text-sm font-semibold text-yellow-700">
                    {review.restaurant.averageRating.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({review.restaurant.totalReviews} reviews)
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Review Content */}
        <div className="bg-white border-b border-gray-200 p-4">
          {/* Rating */}
          <div className="flex items-center gap-1 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-6 h-6 ${
                  i < review.rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'fill-gray-200 text-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Title */}
          {review.title && (
            <h2 className="text-xl font-bold text-gray-900 mb-3">{review.title}</h2>
          )}

          {/* Content */}
          {review.content && (
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
              {review.content}
            </p>
          )}

          {/* Visit Date */}
          {review.visitDate && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
              <Calendar className="w-4 h-4" />
              <span>Visited {format(new Date(review.visitDate), 'MMMM d, yyyy')}</span>
            </div>
          )}

          {/* Posted Date */}
          <p className="text-xs text-gray-400">
            Posted {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
          </p>
        </div>

        {/* Like Button */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <button
            onClick={handleLike}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              review.isLiked
                ? 'bg-primary/10 text-primary'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <ThumbsUp className={`w-5 h-5 ${review.isLiked ? 'fill-current' : ''}`} />
            <span>{review.likesCount} {review.likesCount === 1 ? 'Like' : 'Likes'}</span>
          </button>
        </div>

        {/* Reviewer Info */}
        <div className="bg-white p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">REVIEWED BY</h3>
          <Link href={`/profile/${review.user.id}`}>
            <div className="flex items-center gap-3 mb-3">
              {review.user.avatarUrl ? (
                <img
                  src={review.user.avatarUrl}
                  alt={review.user.fullName}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                  {review.user.fullName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{review.user.fullName}</p>
                <p className="text-sm text-gray-500">@{review.user.username}</p>
              </div>
            </div>
          </Link>

          {/* Mutual Friends */}
          {mutualFriends.length > 0 && (
            <div className="bg-primary/5 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {mutualFriends.slice(0, 3).map((friend) => (
                    friend.avatarUrl ? (
                      <img
                        key={friend.id}
                        src={friend.avatarUrl}
                        alt={friend.fullName}
                        className="w-6 h-6 rounded-full border-2 border-white object-cover"
                      />
                    ) : (
                      <div
                        key={friend.id}
                        className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
                      >
                        <span className="text-[10px] font-bold text-white">
                          {friend.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )
                  ))}
                </div>
                <p className="text-xs text-gray-700">
                  Followed by{' '}
                  <span className="font-semibold">{mutualFriends[0].fullName}</span>
                  {mutualFriends.length > 1 && (
                    <> and {mutualFriends.length - 1} other{mutualFriends.length > 2 ? 's' : ''} you follow</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Follow Button */}
          <button
            onClick={handleFollow}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
              isFollowing
                ? 'bg-gray-100 text-gray-700'
                : 'bg-primary text-white active:scale-95'
            }`}
          >
            {isFollowing ? (
              <>
                <UserCheck className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                Follow {review.user.fullName.split(' ')[0]}
              </>
            )}
          </button>
        </div>

        {/* Recent Reviews from User */}
        {recentReviews.length > 0 && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">
              MORE FROM {review.user.fullName.split(' ')[0].toUpperCase()}
            </h3>
            <div className="space-y-2">
              {recentReviews.map((recentReview) => (
                <Link key={recentReview.id} href={`/review/${recentReview.id}`}>
                  <div className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3">
                    {recentReview.restaurant?.imageUrl ? (
                      <img
                        src={recentReview.restaurant.imageUrl}
                        alt={recentReview.restaurant.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                        <span className="text-xl">🍽️</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm">
                        {recentReview.restaurant?.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-2.5 h-2.5 ${
                                i < recentReview.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'fill-gray-200 text-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(recentReview.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

