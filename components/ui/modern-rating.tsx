'use client';

interface ModernRatingProps {
  rating: number; // 1-5
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

export function ModernRating({ 
  rating, 
  size = 'md', 
  showLabel = false,
  animated = true 
}: ModernRatingProps) {
  // Normalize rating to 0-100 scale for easier calculations
  const percentage = (rating / 5) * 100;
  
  // Determine color gradient based on rating
  const getColorClasses = () => {
    if (rating >= 4.5) {
      return {
        bg: 'from-emerald-500 via-teal-500 to-cyan-500',
        text: 'text-white',
        ring: 'ring-emerald-500/30',
        glow: 'shadow-emerald-500/50'
      };
    } else if (rating >= 4) {
      return {
        bg: 'from-green-500 via-lime-500 to-green-400',
        text: 'text-white',
        ring: 'ring-green-500/30',
        glow: 'shadow-green-500/50'
      };
    } else if (rating >= 3) {
      return {
        bg: 'from-amber-500 via-yellow-500 to-orange-400',
        text: 'text-white',
        ring: 'ring-amber-500/30',
        glow: 'shadow-amber-500/50'
      };
    } else if (rating >= 2) {
      return {
        bg: 'from-orange-500 via-orange-400 to-yellow-500',
        text: 'text-white',
        ring: 'ring-orange-500/30',
        glow: 'shadow-orange-500/50'
      };
    } else {
      return {
        bg: 'from-slate-500 via-gray-500 to-slate-400',
        text: 'text-white',
        ring: 'ring-slate-500/30',
        glow: 'shadow-slate-500/50'
      };
    }
  };

  // Get emoji based on rating
  const getEmoji = () => {
    if (rating >= 4.5) return '🔥';
    if (rating >= 4) return '😍';
    if (rating >= 3) return '😊';
    if (rating >= 2) return '😐';
    return '😕';
  };

  const colors = getColorClasses();
  
  // Size configurations
  const sizeClasses = {
    sm: {
      container: 'w-12 h-12',
      text: 'text-sm',
      emoji: 'text-base',
      label: 'text-[10px]'
    },
    md: {
      container: 'w-14 h-14',
      text: 'text-base',
      emoji: 'text-lg',
      label: 'text-xs'
    },
    lg: {
      container: 'w-20 h-20',
      text: 'text-2xl',
      emoji: 'text-3xl',
      label: 'text-sm'
    }
  };

  const sizes = sizeClasses[size];

  const content = (
    <div className="flex items-center gap-2">
      <div 
        className={`
          ${sizes.container}
          rounded-2xl
          bg-gradient-to-br ${colors.bg}
          flex items-center justify-center
          relative
          ring-4 ${colors.ring}
          shadow-lg ${colors.glow}
          transition-all duration-300
          hover:scale-105
          group
        `}
      >
        {/* Background pattern overlay */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.5),transparent)]" />
        </div>
        
        {/* Rating number */}
        <div className="relative z-10 flex flex-col items-center justify-center">
          <span className={`font-black ${colors.text} ${sizes.text} leading-none tracking-tight`}>
            {rating.toFixed(1)}
          </span>
        </div>

        {/* Sparkle effect on hover */}
        <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-2 h-2 bg-white rounded-full animate-ping" />
        </div>
      </div>

      {showLabel && (
        <div className="flex flex-col">
          <span className={`font-bold text-gray-900 ${sizes.label}`}>
            {rating >= 4 ? 'Amazing' : rating >= 3 ? 'Good' : rating >= 2 ? 'Okay' : 'Meh'}
          </span>
          <span className={`text-gray-500 ${sizes.label}`}>
            rating
          </span>
        </div>
      )}
    </div>
  );

  if (animated) {
    return (
      <div className="animate-in fade-in zoom-in duration-300">
        {content}
      </div>
    );
  }

  return content;
}

// Alternative compact version - horizontal pill style
interface CompactRatingProps {
  rating: number;
  showEmoji?: boolean;
}

export function CompactRating({ rating, showEmoji = true }: CompactRatingProps) {
  const getColorClasses = () => {
    if (rating >= 4.5) return 'from-emerald-500 to-teal-500';
    if (rating >= 4) return 'from-green-500 to-lime-500';
    if (rating >= 3) return 'from-amber-500 to-yellow-500';
    if (rating >= 2) return 'from-orange-500 to-yellow-500';
    return 'from-slate-500 to-gray-500';
  };

  const getEmoji = () => {
    if (rating >= 4.5) return '🔥';
    if (rating >= 4) return '😍';
    if (rating >= 3) return '😊';
    if (rating >= 2) return '😐';
    return '😕';
  };

  return (
    <div 
      className={`
        inline-flex items-center gap-1.5
        px-2.5 py-1
        rounded-full
        bg-gradient-to-r ${getColorClasses()}
        shadow-md
        transition-all duration-300
        hover:scale-105
      `}
    >
      {showEmoji && (
        <span className="text-sm leading-none">{getEmoji()}</span>
      )}
      <span className="text-sm font-bold text-white leading-none">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

