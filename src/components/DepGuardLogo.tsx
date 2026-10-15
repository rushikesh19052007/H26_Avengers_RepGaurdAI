import React from 'react';

interface DepGuardLogoProps {
  className?: string;
  size?: number;
}

export const DepGuardLogo: React.FC<DepGuardLogoProps> = ({ className = '', size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="DepGuard AI Logo"
    >
      {/* Outer rounded container */}
      <rect width="100" height="100" rx="24" fill="#4F46E5" />

      {/* Outer Shield Outline */}
      <path
        d="M50 16L79 26V52C79 70 66 84 50 88C34 84 21 70 21 52V26L50 16Z"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Triangle connection lines */}
      <line x1="50" y1="42" x2="37" y2="60" stroke="white" strokeWidth="6" strokeLinecap="round" />
      <line x1="50" y1="42" x2="63" y2="60" stroke="white" strokeWidth="6" strokeLinecap="round" />
      <line x1="37" y1="60" x2="63" y2="60" stroke="white" strokeWidth="6" strokeLinecap="round" />

      {/* Top Node */}
      <circle cx="50" cy="42" r="7" fill="white" />

      {/* Bottom Left Node */}
      <circle cx="37" cy="60" r="7" fill="#C7D2FE" />

      {/* Bottom Right Node */}
      <circle cx="63" cy="60" r="7" fill="#C7D2FE" />
    </svg>
  );
};
