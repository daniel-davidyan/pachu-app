import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Optimized profile endpoint that returns all profile data in a single request:
 * - Profile info
 * - Stats (experiences, followers, following)
 * - First batch of reviews
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const tab = searchParams.get('tab') || 'published'; // 'published', 'unpublished', or 'all'

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    console.log('[profile/me] Auth check:', { 
      hasUser: !!user, 
      userId: user?.id?.slice(0, 8), 
      userError: userError?.message 
    });
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message },
        { status: 401 }
      );
    }

    // Run all queries in parallel for maximum performance
    const [
      profileResult,
      experiencesCountResult,
      followersCountResult,
      followingCountResult,
      reviewsResult,
    ] = await Promise.all([
      // 1. Get profile
      supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, created_at')
        .eq('id', user.id)
        .single(),
      
      // 2. Get experiences count
      supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      
      // 3. Get followers count
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id),
      
      // 4. Get following count
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id),
      
      // 5. Get reviews with all related data
      (async () => {
        let query = supabase
          .from('reviews')
          .select(`
            id,
            rating,
            content,
            created_at,
            user_id,
            restaurant_id,
            is_published,
            restaurants (
              id,
              name,
              address,
              image_url,
              google_place_id
            ),
            review_photos (
              photo_url,
              sort_order
            ),
            review_videos (
              video_url,
              thumbnail_url,
              duration_seconds,
              sort_order
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        // Filter by published status
        if (tab === 'published') {
          query = query.eq('is_published', true);
        } else if (tab === 'unpublished') {
          query = query.eq('is_published', false);
        }

        return query;
      })(),
    ]);

    // Check for profile error - auto-create profile if it doesn't exist
    let profile = profileResult.data;
    
    if (profileResult.error) {
      // Profile doesn't exist - create it automatically
      if (profileResult.error.code === 'PGRST116') {
        console.log('Profile not found, creating one for user:', user.id);
        
        // Get user metadata for profile creation
        const email = user.email || '';
        let baseUsername = user.user_metadata?.username || 
                          user.user_metadata?.full_name?.toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
                          email.split('@')[0]?.replace(/[^a-z0-9_]/g, '_') ||
                          'user';
        
        // Ensure username is valid (alphanumeric and underscores only, 3-30 chars)
        baseUsername = baseUsername.slice(0, 25).replace(/^[^a-z]+/, ''); // Remove leading non-letters
        if (baseUsername.length < 3) {
          baseUsername = 'user';
        }
        
        const fullName = user.user_metadata?.full_name || 
                        user.user_metadata?.name ||
                        baseUsername;
        const avatarUrl = user.user_metadata?.avatar_url ||
                         user.user_metadata?.picture ||
                         null;
        
        // Try to create profile with unique username
        let username = baseUsername;
        let attempts = 0;
        let newProfile = null;
        let createError = null;
        
        while (attempts < 5) {
          const { data, error } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              username: username,
              full_name: fullName,
              avatar_url: avatarUrl,
              bio: null,
            })
            .select()
            .single();
          
          if (!error) {
            newProfile = data;
            break;
          }
          
          // If username conflict, try with random suffix
          if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
            attempts++;
            username = `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`;
            console.log(`Username conflict, trying: ${username}`);
          } else {
            createError = error;
            break;
          }
        }
        
        if (createError || !newProfile) {
          console.error('Error creating profile:', createError);
          return NextResponse.json(
            { error: 'Failed to create profile', details: createError?.message },
            { status: 500 }
          );
        }
        
        profile = newProfile;
      } else {
        console.error('Error fetching profile:', profileResult.error);
        return NextResponse.json(
          { error: 'Failed to fetch profile', details: profileResult.error.message },
          { status: 500 }
        );
      }
    }

    // Ensure profile exists at this point
    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const reviews = reviewsResult.data || [];

    // Get review IDs for likes/comments counts
    const reviewIds = reviews.map(r => r.id);

    // If we have reviews, get likes and comments counts in parallel
    let likesData: any[] = [];
    let userLikes: string[] = [];
    let commentsData: any[] = [];

    if (reviewIds.length > 0) {
      const [likesResult, userLikesResult, commentsResult] = await Promise.all([
        // Get all likes for these reviews
        supabase
          .from('review_likes')
          .select('review_id')
          .in('review_id', reviewIds),
        
        // Get user's own likes
        supabase
          .from('review_likes')
          .select('review_id')
          .eq('user_id', user.id)
          .in('review_id', reviewIds),
        
        // Get comments counts
        supabase
          .from('review_comments')
          .select('review_id')
          .in('review_id', reviewIds),
      ]);

      likesData = likesResult.data || [];
      userLikes = userLikesResult.data?.map(l => l.review_id) || [];
      commentsData = commentsResult.data || [];
    }

    // Count likes and comments per review
    const likesCounts: { [key: string]: number } = {};
    likesData.forEach(like => {
      likesCounts[like.review_id] = (likesCounts[like.review_id] || 0) + 1;
    });

    const commentsCounts: { [key: string]: number } = {};
    commentsData.forEach(comment => {
      commentsCounts[comment.review_id] = (commentsCounts[comment.review_id] || 0) + 1;
    });

    // Format reviews
    const formattedReviews = reviews.map(review => ({
      ...review,
      likesCount: likesCounts[review.id] || 0,
      commentsCount: commentsCounts[review.id] || 0,
      isLiked: userLikes.includes(review.id),
      isPublished: review.is_published,
      user: {
        id: profile.id,
        username: profile.username,
        fullName: profile.full_name || profile.username,
        avatarUrl: profile.avatar_url,
      },
    }));

    // Build response
    const response = {
      profile: {
        id: profile.id,
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        created_at: profile.created_at,
      },
      stats: {
        experiences: experiencesCountResult.count || 0,
        followers: followersCountResult.count || 0,
        following: followingCountResult.count || 0,
      },
      reviews: formattedReviews,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in profile/me API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
