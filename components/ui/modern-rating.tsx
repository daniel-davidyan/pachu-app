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
        className="relative inline-flex items-center justify-center transition-all duration-500 ease-out hover:scale-110 hover:shadow-xl hover:shadow-pink-500/30"
        style={{ 
          width: config.size, 
          height: config.size,
          filter: 'drop-shadow(0 4px 12px rgba(236, 72, 153, 0.15))'
        }}
      >
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90 transition-transform duration-700 ease-in-out"
        >
          {/* Gradient Definition */}
          <defs>
            <linearGradient id="ratingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#D946EF" />
              <stop offset="100%" stopColor="#C026D3" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Background Circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth={config.strokeWidth}
            className="transition-all duration-300"
          />
          
          {/* Progress Circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="url(#ratingGradient)"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#glow)"
            className="transition-all duration-1000 ease-out"
            style={{
              animation: 'drawProgress 1.5s ease-out forwards'
            }}
          />
        </svg>
        
        {/* Rating number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-gray-700 ${config.textSize} leading-none transition-all duration-300`}>
            {rating.toFixed(1)}
          </span>
        </div>

        {/* Subtle pulse glow on hover */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500/10 to-purple-600/10 opacity-0 hover:opacity-100 transition-opacity duration-500 blur-xl" />
      </div>

      {showLabel && (
        <div className="flex flex-col transition-all duration-300">
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
      <div className="animate-in fade-in zoom-in duration-700 slide-in-from-bottom-4">
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
  
  // Compact size configuration
  const size = 40;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div 
      className="relative inline-flex items-center justify-center transition-all duration-500 ease-out hover:scale-110 hover:shadow-lg hover:shadow-pink-500/20 group"
      style={{ 
        width: size, 
        height: size,
        filter: 'drop-shadow(0 2px 8px rgba(236, 72, 153, 0.12))'
      }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 transition-transform duration-700 ease-in-out"
      >
        {/* Gradient Definition */}
        <defs>
          <linearGradient id="compactRatingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EC4899" />
            <stop offset="50%" stopColor="#D946EF" />
            <stop offset="100%" stopColor="#C026D3" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="compactGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          className="transition-all duration-300"
        />
        
        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#compactRatingGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter="url(#compactGlow)"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      
      {/* Rating number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-gray-700 leading-none transition-all duration-300 group-hover:scale-110">
          {rating.toFixed(1)}
        </span>
      </div>

      {/* Subtle glow on hover */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md" />
    </div>
  );
}

