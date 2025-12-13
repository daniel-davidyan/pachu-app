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
  
  // Dynamic gradient colors based on rating - lighter for low, darker for high
  const getGradientColors = () => {
    if (rating >= 4.5) {
      // Very high rating - darkest colors
      return {
        start: '#C026D3', // fuchsia-600
        middle: '#A21CAF', // fuchsia-700
        end: '#86198F' // fuchsia-800
      };
    } else if (rating >= 4) {
      // High rating - dark colors
      return {
        start: '#D946EF', // fuchsia-500
        middle: '#C026D3', // fuchsia-600
        end: '#A21CAF' // fuchsia-700
      };
    } else if (rating >= 3) {
      // Medium rating - medium colors
      return {
        start: '#EC4899', // pink-500
        middle: '#D946EF', // fuchsia-500
        end: '#C026D3' // fuchsia-600
      };
    } else if (rating >= 2) {
      // Low-medium rating - light colors
      return {
        start: '#F9A8D4', // pink-300
        middle: '#F472B6', // pink-400
        end: '#EC4899' // pink-500
      };
    } else {
      // Very low rating - lightest colors
      return {
        start: '#FBE7F3', // pink-100
        middle: '#FBCFE8', // pink-200
        end: '#F9A8D4' // pink-300
      };
    }
  };

  const colors = getGradientColors();
  
  // Size configurations
  const sizeConfig = {
    sm: {
      size: 48,
      strokeWidth: 4,
      textSize: 'text-sm',
      labelSize: 'text-[10px]'
    },
    md: {
      size: 56,
      strokeWidth: 5,
      textSize: 'text-base',
      labelSize: 'text-xs'
    },
    lg: {
      size: 80,
      strokeWidth: 6,
      textSize: 'text-2xl',
      labelSize: 'text-sm'
    }
  };

  const config = sizeConfig[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const content = (
    <div className="flex items-center gap-2">
      <div 
        className="relative inline-flex items-center justify-center transition-all duration-300 hover:scale-105"
        style={{ width: config.size, height: config.size }}
      >
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          {/* Gradient Definition */}
          <defs>
            <linearGradient id={`ratingGradient-${rating}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="50%" stopColor={colors.middle} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
          </defs>
          
          {/* Background Circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={config.strokeWidth}
          />
          
          {/* Progress Circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={`url(#ratingGradient-${rating})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        
        {/* Rating number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-gray-700 ${config.textSize} leading-none`}>
            {rating.toFixed(1)}
          </span>
        </div>
      </div>

      {showLabel && (
        <div className="flex flex-col">
          <span className={`font-bold text-gray-900 ${config.labelSize}`}>
            {rating >= 4 ? 'Amazing' : rating >= 3 ? 'Good' : rating >= 2 ? 'Okay' : 'Meh'}
          </span>
          <span className={`text-gray-500 ${config.labelSize}`}>
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

// Alternative compact version - circular progress style
interface CompactRatingProps {
  rating: number;
}

export function CompactRating({ rating }: CompactRatingProps) {
  const percentage = (rating / 5) * 100;
  
  // Dynamic gradient colors based on rating - lighter for low, darker for high
  const getGradientColors = () => {
    if (rating >= 4.5) {
      // Very high rating - darkest colors
      return {
        start: '#C026D3', // fuchsia-600
        middle: '#A21CAF', // fuchsia-700
        end: '#86198F' // fuchsia-800
      };
    } else if (rating >= 4) {
      // High rating - dark colors
      return {
        start: '#D946EF', // fuchsia-500
        middle: '#C026D3', // fuchsia-600
        end: '#A21CAF' // fuchsia-700
      };
    } else if (rating >= 3) {
      // Medium rating - medium colors
      return {
        start: '#EC4899', // pink-500
        middle: '#D946EF', // fuchsia-500
        end: '#C026D3' // fuchsia-600
      };
    } else if (rating >= 2) {
      // Low-medium rating - light colors
      return {
        start: '#F9A8D4', // pink-300
        middle: '#F472B6', // pink-400
        end: '#EC4899' // pink-500
      };
    } else {
      // Very low rating - lightest colors
      return {
        start: '#FBE7F3', // pink-100
        middle: '#FBCFE8', // pink-200
        end: '#F9A8D4' // pink-300
      };
    }
  };

  const colors = getGradientColors();
  
  // Compact size configuration
  const size = 40;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className="relative inline-flex items-center justify-center transition-all duration-300 hover:scale-105"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Gradient Definition */}
        <defs>
          <linearGradient id={`compactRatingGradient-${rating}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="50%" stopColor={colors.middle} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
        
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#compactRatingGradient-${rating})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      
      {/* Rating number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-gray-700 leading-none">
          {rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

