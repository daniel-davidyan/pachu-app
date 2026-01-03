'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Utensils, 
  Heart, 
  X,
  Check,
  Loader2,
  MapPin,
  Users,
  Briefcase,
  User,
  Home,
  Search,
  Plus,
  Star
} from 'lucide-react';

// Onboarding steps
type OnboardingStep = 
  | 'welcome' 
  | 'dietary' 
  | 'likes' 
  | 'dislikes' 
  | 'contexts'
  | 'complete';

interface TasteProfile {
  isKosher: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  glutenFree: boolean;
  likes: string[];
  dislikes: string[];
  freeText: string;
  dateRestaurants: Array<{ googlePlaceId: string; name: string }>;
  friendsRestaurants: Array<{ googlePlaceId: string; name: string }>;
  familyRestaurants: Array<{ googlePlaceId: string; name: string }>;
  soloRestaurants: Array<{ googlePlaceId: string; name: string }>;
  workRestaurants: Array<{ googlePlaceId: string; name: string }>;
}

// Predefined food preferences
const FOOD_LIKES = [
  { id: 'italian', label: 'Italian', emoji: '🍝' },
  { id: 'sushi', label: 'Sushi & Japanese', emoji: '🍣' },
  { id: 'mexican', label: 'Mexican', emoji: '🌮' },
  { id: 'chinese', label: 'Chinese', emoji: '🥡' },
  { id: 'indian', label: 'Indian', emoji: '🍛' },
  { id: 'thai', label: 'Thai', emoji: '🍜' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🥙' },
  { id: 'american', label: 'American', emoji: '🍔' },
  { id: 'seafood', label: 'Seafood', emoji: '🦐' },
  { id: 'steakhouse', label: 'Steakhouse', emoji: '🥩' },
  { id: 'pizza', label: 'Pizza', emoji: '🍕' },
  { id: 'asian_fusion', label: 'Asian Fusion', emoji: '🥢' },
  { id: 'french', label: 'French', emoji: '🥐' },
  { id: 'middle_eastern', label: 'Middle Eastern', emoji: '🧆' },
  { id: 'breakfast', label: 'Breakfast & Brunch', emoji: '🥞' },
  { id: 'coffee', label: 'Coffee & Cafes', emoji: '☕' },
  { id: 'desserts', label: 'Desserts', emoji: '🍰' },
  { id: 'healthy', label: 'Healthy & Salads', emoji: '🥗' },
];

const FOOD_DISLIKES = [
  { id: 'spicy', label: 'Spicy food', emoji: '🌶️' },
  { id: 'raw_fish', label: 'Raw fish', emoji: '🐟' },
  { id: 'seafood', label: 'Seafood', emoji: '🦐' },
  { id: 'dairy', label: 'Dairy', emoji: '🧀' },
  { id: 'mushrooms', label: 'Mushrooms', emoji: '🍄' },
  { id: 'onions', label: 'Onions', emoji: '🧅' },
  { id: 'garlic', label: 'Garlic', emoji: '🧄' },
  { id: 'nuts', label: 'Nuts', emoji: '🥜' },
  { id: 'eggs', label: 'Eggs', emoji: '🥚' },
  { id: 'soy', label: 'Soy', emoji: '🫘' },
  { id: 'fried', label: 'Fried food', emoji: '🍟' },
  { id: 'sweet', label: 'Very sweet', emoji: '🍬' },
];

const CONTEXT_OPTIONS = [
  { id: 'date', label: 'Date Night', emoji: '💑', icon: Heart, color: 'from-pink-500 to-rose-500' },
  { id: 'friends', label: 'With Friends', emoji: '👯', icon: Users, color: 'from-blue-500 to-indigo-500' },
  { id: 'family', label: 'Family Dinner', emoji: '👨‍👩‍👧‍👦', icon: Home, color: 'from-green-500 to-emerald-500' },
  { id: 'solo', label: 'Solo Dining', emoji: '🧘', icon: User, color: 'from-purple-500 to-violet-500' },
  { id: 'work', label: 'Business Meal', emoji: '💼', icon: Briefcase, color: 'from-amber-500 to-orange-500' },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check if we're in edit mode (coming from settings)
  const isEditMode = searchParams.get('edit') === 'true';
  const initialStep = searchParams.get('step') as OnboardingStep | null;
  
  const [step, setStep] = useState<OnboardingStep>(isEditMode && initialStep ? initialStep : 'welcome');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [profile, setProfile] = useState<TasteProfile>({
    isKosher: false,
    isVegetarian: false,
    isVegan: false,
    glutenFree: false,
    likes: [],
    dislikes: [],
    freeText: '',
    dateRestaurants: [],
    friendsRestaurants: [],
    familyRestaurants: [],
    soloRestaurants: [],
    workRestaurants: [],
  });

  // Restaurant search state for contexts
  const [activeContext, setActiveContext] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ place_id: string; name: string; address: string; rating?: number; categories?: string[] }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search function - uses local cache (fast & free!)
  const searchRestaurants = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search from local restaurant_cache table
      const response = await fetch(`/api/restaurants/cache/search?query=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();
      
      if (data.results) {
        setSearchResults(data.results.slice(0, 8).map((r: any) => ({
          place_id: r.place_id,
          name: r.name,
          address: r.address || '',
          rating: r.rating,
          categories: r.categories || []
        })));
      }
    } catch (error) {
      console.error('Error searching restaurants:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchRestaurants(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchRestaurants]);

  // Add restaurant to context
  const addRestaurantToContext = (contextId: string, restaurant: { place_id: string; name: string }) => {
    const key = `${contextId}Restaurants` as keyof TasteProfile;
    const currentList = (profile[key] as Array<{ googlePlaceId: string; name: string }>) || [];
    
    // Check if already added
    if (currentList.some(r => r.googlePlaceId === restaurant.place_id)) {
      return;
    }

    setProfile(prev => ({
      ...prev,
      [key]: [...currentList, { googlePlaceId: restaurant.place_id, name: restaurant.name }]
    }));
  };

  // Remove restaurant from context
  const removeRestaurantFromContext = (contextId: string, placeId: string) => {
    const key = `${contextId}Restaurants` as keyof TasteProfile;
    const currentList = (profile[key] as Array<{ googlePlaceId: string; name: string }>) || [];
    
    setProfile(prev => ({
      ...prev,
      [key]: currentList.filter(r => r.googlePlaceId !== placeId)
    }));
  };

  // Close context modal
  const closeContextModal = () => {
    setActiveContext(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Check if user already has a taste profile
  useEffect(() => {
    checkExistingProfile();
  }, [isEditMode]);

  const checkExistingProfile = async () => {
    if (hasLoadedProfile) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/taste-profile');
      const data = await response.json();
      
      // If in edit mode, always load the profile and skip to first real step
      if (isEditMode) {
        if (data.profile) {
          setProfile({
            isKosher: data.profile.isKosher || false,
            isVegetarian: data.profile.isVegetarian || false,
            isVegan: data.profile.isVegan || false,
            glutenFree: data.profile.glutenFree || false,
            likes: data.profile.likes || [],
            dislikes: data.profile.dislikes || [],
            freeText: data.profile.freeText || '',
            dateRestaurants: data.profile.dateRestaurants || [],
            friendsRestaurants: data.profile.friendsRestaurants || [],
            familyRestaurants: data.profile.familyRestaurants || [],
            soloRestaurants: data.profile.soloRestaurants || [],
            workRestaurants: data.profile.workRestaurants || [],
          });
        }
        // If no specific step requested, skip welcome and go to dietary
        if (!initialStep) {
          setStep('dietary');
        }
        setHasLoadedProfile(true);
        return;
      }
      
      // Normal flow: redirect if onboarding already completed
      if (data.onboardingCompleted) {
        router.push('/map');
        return;
      }
      
      if (data.profile) {
        // Load existing partial profile
        setProfile({
          isKosher: data.profile.isKosher || false,
          isVegetarian: data.profile.isVegetarian || false,
          isVegan: data.profile.isVegan || false,
          glutenFree: data.profile.glutenFree || false,
          likes: data.profile.likes || [],
          dislikes: data.profile.dislikes || [],
          freeText: data.profile.freeText || '',
          dateRestaurants: data.profile.dateRestaurants || [],
          friendsRestaurants: data.profile.friendsRestaurants || [],
          familyRestaurants: data.profile.familyRestaurants || [],
          soloRestaurants: data.profile.soloRestaurants || [],
          workRestaurants: data.profile.workRestaurants || [],
        });
      }
      setHasLoadedProfile(true);
    } catch (error) {
      console.error('Error checking profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async (completed: boolean = false) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/taste-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          onboardingCompleted: completed,
          onboardingStep: steps.indexOf(step),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }

      if (completed) {
        // Rebuild embedding
        await fetch('/api/user/taste-profile/rebuild-embedding', {
          method: 'POST',
        });
      }

      return true;
    } catch (error) {
      console.error('Error saving profile:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const steps: OnboardingStep[] = ['welcome', 'dietary', 'likes', 'dislikes', 'contexts', 'complete'];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

  const nextStep = async () => {
    // Save progress (don't block if not logged in)
    try {
      await saveProfile(false);
    } catch (error) {
      // Continue anyway - will save when completing
      console.log('Could not save progress:', error);
    }
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const completeOnboarding = async () => {
    const success = await saveProfile(true);
    if (success) {
      // Redirect to settings if in edit mode, otherwise to map
      router.push(isEditMode ? '/settings' : '/map');
    }
  };

  const toggleLike = (id: string) => {
    setProfile(prev => ({
      ...prev,
      likes: prev.likes.includes(id)
        ? prev.likes.filter(l => l !== id)
        : [...prev.likes, id]
    }));
  };

  const toggleDislike = (id: string) => {
    setProfile(prev => ({
      ...prev,
      dislikes: prev.dislikes.includes(id)
        ? prev.dislikes.filter(d => d !== id)
        : [...prev.dislikes, id]
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-pink-50">
      {/* Progress Bar */}
      {step !== 'welcome' && step !== 'complete' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <div className="h-1 bg-gray-200">
            <div 
              className="h-full bg-gradient-to-r from-primary to-pink-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              onClick={prevStep}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-600">
              {isEditMode ? 'Edit Profile' : `Step ${currentStepIndex} of ${steps.length - 2}`}
            </span>
            <button 
              onClick={() => router.push(isEditMode ? '/settings' : '/map')}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={`px-6 pb-32 ${step !== 'welcome' && step !== 'complete' ? 'pt-24' : 'pt-12'}`}>
        
        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-pink-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-primary/30 animate-pulse">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {isEditMode ? (
                <>
                  Update Your
                  <br />
                  <span className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
                    Taste Profile
                  </span>
                </>
              ) : (
                <>
                  Let's Build Your
                  <br />
                  <span className="bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
                    Taste Profile
                  </span>
                </>
              )}
            </h1>
            
            <p className="text-lg text-gray-600 max-w-md mb-12">
              {isEditMode 
                ? "Review and update your food preferences. Your recommendations will be updated automatically."
                : "Help Pachu understand your food preferences so we can find you the perfect restaurants every time."
              }
            </p>

            <button
              onClick={nextStep}
              className="px-12 py-4 bg-gradient-to-r from-primary to-pink-500 text-white rounded-full font-semibold text-lg shadow-xl shadow-primary/30 hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2"
            >
              {isEditMode ? 'Start Editing' : 'Get Started'}
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => router.push(isEditMode ? '/settings' : '/map')}
              className="mt-6 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isEditMode ? 'Cancel' : 'Skip for now'}
            </button>
          </div>
        )}

        {/* Dietary Restrictions */}
        {step === 'dietary' && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Dietary Preferences
              </h2>
              <p className="text-gray-600">
                Do you have any dietary restrictions?
              </p>
            </div>

            <div className="space-y-3">
              {[
                { key: 'isKosher', label: 'Kosher Only', emoji: '✡️', desc: 'Only show kosher restaurants' },
                { key: 'isVegan', label: 'Vegan', emoji: '🌱', desc: 'No animal products' },
                { key: 'isVegetarian', label: 'Vegetarian', emoji: '🥬', desc: 'No meat' },
                { key: 'glutenFree', label: 'Gluten-Free', emoji: '🌾', desc: 'No gluten' },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setProfile(prev => ({ 
                    ...prev, 
                    [item.key]: !prev[item.key as keyof TasteProfile],
                    // If selecting vegan, also select vegetarian
                    ...(item.key === 'isVegan' && !prev.isVegan ? { isVegetarian: true } : {})
                  }))}
                  className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                    profile[item.key as keyof TasteProfile]
                      ? 'border-primary bg-primary/5 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-3xl">{item.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900">{item.label}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  {profile[item.key as keyof TasteProfile] && (
                    <Check className="w-6 h-6 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Food Likes */}
        {step === 'likes' && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                What Do You Love?
              </h2>
              <p className="text-gray-600">
                Select cuisines and food types you enjoy
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FOOD_LIKES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleLike(item.id)}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                    profile.likes.includes(item.id)
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <span className={`text-sm font-medium ${
                    profile.likes.includes(item.id) ? 'text-primary' : 'text-gray-700'
                  }`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {profile.likes.length > 0 && (
              <p className="text-center mt-4 text-sm text-primary font-medium">
                {profile.likes.length} selected ✨
              </p>
            )}
          </div>
        )}

        {/* Food Dislikes */}
        {step === 'dislikes' && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-orange-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Any Dislikes?
              </h2>
              <p className="text-gray-600">
                Select foods you'd rather avoid
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FOOD_DISLIKES.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleDislike(item.id)}
                  className={`p-3 rounded-xl border-2 transition-all flex items-center gap-2 ${
                    profile.dislikes.includes(item.id)
                      ? 'border-orange-500 bg-orange-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{item.emoji}</span>
                  <span className={`text-sm font-medium ${
                    profile.dislikes.includes(item.id) ? 'text-orange-600' : 'text-gray-700'
                  }`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Free text for other dislikes */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anything else to avoid?
              </label>
              <textarea
                value={profile.freeText}
                onChange={(e) => setProfile(prev => ({ ...prev, freeText: e.target.value }))}
                placeholder="e.g., I'm allergic to shellfish, don't like very spicy food..."
                className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-primary outline-none transition-colors resize-none"
                rows={3}
              />
            </div>
          </div>
        )}

        {/* Dining Contexts */}
        {step === 'contexts' && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Perfect For...
              </h2>
              <p className="text-gray-600">
                Tap to add your favorite restaurants for each occasion
              </p>
            </div>

            <div className="space-y-3">
              {CONTEXT_OPTIONS.map((context) => {
                const Icon = context.icon;
                const key = `${context.id}Restaurants` as keyof TasteProfile;
                const restaurants = (profile[key] as Array<{ googlePlaceId: string; name: string }>) || [];
                const count = restaurants.length;
                
                return (
                  <div
                    key={context.id}
                    onClick={() => setActiveContext(context.id)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${
                      count > 0
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${context.color} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{context.label}</p>
                        {count > 0 ? (
                          <p className="text-sm text-primary font-medium">
                            {count} restaurant{count > 1 ? 's' : ''} added
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">
                            {context.emoji} Tap to add favorites
                          </p>
                        )}
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        count > 0 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {count > 0 ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                    
                    {/* Show selected restaurants */}
                    {count > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {restaurants.slice(0, 3).map(r => (
                            <span 
                              key={r.googlePlaceId}
                              className="text-xs bg-white px-2 py-1 rounded-full border border-gray-200 text-gray-700"
                            >
                              {r.name}
                            </span>
                          ))}
                          {count > 3 && (
                            <span className="text-xs px-2 py-1 text-gray-500">
                              +{count - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-center mt-6 text-sm text-gray-500">
              This step is optional - you can skip or add restaurants later
            </p>
          </div>
        )}

        {/* Restaurant Search Modal */}
        {activeContext && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Add Restaurants for {CONTEXT_OPTIONS.find(c => c.id === activeContext)?.label}
                  </h3>
                  <button
                    onClick={closeContextModal}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a restaurant..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Selected Restaurants */}
                {(() => {
                  const key = `${activeContext}Restaurants` as keyof TasteProfile;
                  const selected = (profile[key] as Array<{ googlePlaceId: string; name: string }>) || [];
                  
                  if (selected.length > 0) {
                    return (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-500 mb-2">Selected ({selected.length})</p>
                        <div className="space-y-2">
                          {selected.map(r => (
                            <div 
                              key={r.googlePlaceId}
                              className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20"
                            >
                              <span className="font-medium text-gray-900">{r.name}</span>
                              <button
                                onClick={() => removeRestaurantFromContext(activeContext, r.googlePlaceId)}
                                className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">Search Results</p>
                    <div className="space-y-2">
                      {searchResults.map(r => {
                        const key = `${activeContext}Restaurants` as keyof TasteProfile;
                        const selected = (profile[key] as Array<{ googlePlaceId: string; name: string }>) || [];
                        const isAlreadyAdded = selected.some(s => s.googlePlaceId === r.place_id);
                        
                        return (
                          <div 
                            key={r.place_id}
                            onClick={() => !isAlreadyAdded && addRestaurantToContext(activeContext, { place_id: r.place_id, name: r.name })}
                            className={`p-3 rounded-xl border transition-all ${
                              isAlreadyAdded 
                                ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                                : 'border-gray-200 bg-white cursor-pointer hover:border-primary hover:bg-primary/5'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{r.name}</p>
                                <p className="text-sm text-gray-500 truncate">{r.address}</p>
                                {r.categories && r.categories.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {r.categories.slice(0, 3).map((cat, i) => (
                                      <span key={i} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                {r.rating && (
                                  <div className="flex items-center gap-1 text-sm text-amber-600">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    {r.rating}
                                  </div>
                                )}
                                {isAlreadyAdded ? (
                                  <Check className="w-5 h-5 text-primary" />
                                ) : (
                                  <Plus className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {searchQuery && searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-8">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No restaurants found</p>
                    <p className="text-sm text-gray-400">Try a different search term</p>
                  </div>
                )}

                {/* Initial State */}
                {!searchQuery && (
                  <div className="text-center py-8">
                    <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Search for your favorites</p>
                    <p className="text-sm text-gray-400">Type a restaurant name to search</p>
                  </div>
                )}
              </div>

              {/* Done Button */}
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={closeContextModal}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete */}
        {step === 'complete' && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-green-500/30">
              <Check className="w-14 h-14 text-white" />
            </div>
            
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {isEditMode ? 'Profile Updated!' : "You're All Set!"}
            </h1>
            
            <p className="text-lg text-gray-600 max-w-md mb-8">
              {isEditMode 
                ? "Your taste profile has been updated. Recommendations will now reflect your new preferences."
                : "Pachu now knows your taste. We'll recommend restaurants that match your preferences perfectly."
              }
            </p>

            <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mb-8">
              <h3 className="font-semibold text-gray-900 mb-4">Your Profile Summary</h3>
              
              {(profile.isKosher || profile.isVegan || profile.isVegetarian || profile.glutenFree) && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Dietary</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.isKosher && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">✡️ Kosher</span>}
                    {profile.isVegan && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">🌱 Vegan</span>}
                    {profile.isVegetarian && !profile.isVegan && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">🥬 Vegetarian</span>}
                    {profile.glutenFree && <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">🌾 Gluten-Free</span>}
                  </div>
                </div>
              )}

              {profile.likes.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-2">Favorites ({profile.likes.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.likes.slice(0, 5).map(like => {
                      const item = FOOD_LIKES.find(f => f.id === like);
                      return item ? (
                        <span key={like} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                          {item.emoji} {item.label}
                        </span>
                      ) : null;
                    })}
                    {profile.likes.length > 5 && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        +{profile.likes.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {profile.dislikes.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Avoiding ({profile.dislikes.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.dislikes.slice(0, 3).map(dislike => {
                      const item = FOOD_DISLIKES.find(f => f.id === dislike);
                      return item ? (
                        <span key={dislike} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                          {item.emoji} {item.label}
                        </span>
                      ) : null;
                    })}
                    {profile.dislikes.length > 3 && (
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        +{profile.dislikes.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={completeOnboarding}
              disabled={isSaving}
              className="px-12 py-4 bg-gradient-to-r from-primary to-pink-500 text-white rounded-full font-semibold text-lg shadow-xl shadow-primary/30 hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : isEditMode ? (
                <>
                  Back to Settings
                  <ChevronRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  Start Exploring
                  <Sparkles className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      {step !== 'welcome' && step !== 'complete' && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={nextStep}
            disabled={isSaving}
            className="w-full py-4 bg-gradient-to-r from-primary to-pink-500 text-white rounded-full font-semibold text-lg shadow-xl shadow-primary/30 hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : step === 'contexts' ? (
              <>
                Finish Setup
                <Check className="w-5 h-5" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}

