import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    let profilesQuery = supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .limit(50); // Increased limit to show more users

    // If there's a search query, filter by it
    if (query && query.trim().length > 0) {
      profilesQuery = profilesQuery.or(`username.ilike.%${query}%,full_name.ilike.%${query}%`);
    }

    // Exclude current user from results
    if (user) {
      profilesQuery = profilesQuery.neq('id', user.id);
    }

    const { data: profiles, error } = await profilesQuery;

    if (error) {
      console.error('Error searching users:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    // If user is logged in, get mutual friends and follow status for each profile
    if (user && profiles && profiles.length > 0) {
      const profileIds = profiles.map(p => p.id);

      // Get current user's following list
      const { data: currentUserFollowing } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const currentUserFollowingIds = currentUserFollowing?.map(f => f.following_id) || [];

      // Get following status for all profiles
      const followStatusMap = new Map(currentUserFollowingIds.map(id => [id, true]));

      // Get followers of each profile to find mutual friends
      const { data: allFollows } = await supabase
        .from('follows')
        .select('follower_id, following_id')
        .in('following_id', profileIds);

      // Group followers by profile
      const followersByProfile = new Map<string, string[]>();
      allFollows?.forEach((follow: any) => {
        if (!followersByProfile.has(follow.following_id)) {
          followersByProfile.set(follow.following_id, []);
        }
        followersByProfile.get(follow.following_id)?.push(follow.follower_id);
      });

      // Find mutual friends for each profile
      const mutualFriendsByProfile = new Map<string, string[]>();
      profileIds.forEach(profileId => {
        const followers = followersByProfile.get(profileId) || [];
        const mutualIds = currentUserFollowingIds.filter(fid => followers.includes(fid));
        if (mutualIds.length > 0) {
          mutualFriendsByProfile.set(profileId, mutualIds);
        }
      });

      // Get all mutual friend profile data
      const allMutualIds = Array.from(new Set(
        Array.from(mutualFriendsByProfile.values()).flat()
      ));

      const mutualProfilesMap = new Map();
      if (allMutualIds.length > 0) {
        const { data: mutualProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', allMutualIds);

        mutualProfiles?.forEach((p: any) => {
          mutualProfilesMap.set(p.id, {
            id: p.id,
            username: p.username,
            fullName: p.full_name || p.username,
            avatarUrl: p.avatar_url,
          });
        });
      }

      // Enrich profiles with mutual friends and follow status
      const enrichedProfiles = profiles.map(profile => {
        const mutualIds = mutualFriendsByProfile.get(profile.id) || [];
        const mutualFriends = mutualIds
          .map(id => mutualProfilesMap.get(id))
          .filter(Boolean)
          .slice(0, 10); // Limit to 10 mutual friends

        return {
          ...profile,
          isFollowing: followStatusMap.has(profile.id),
          mutualFriends,
        };
      });

      return NextResponse.json({ users: enrichedProfiles });
    }

    return NextResponse.json({ users: profiles || [] });
  } catch (error) {
    console.error('Error in user search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

