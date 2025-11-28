import React from 'react';

interface CustomButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  target?: string;
  style?: React.CSSProperties; 
}

export default function CustomButton({
  children,
  onClick,
  href,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  ariaLabel,
  target = "",
  style
}: CustomButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-300 ease-out rounded-lg disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden cursor-pointer';

  const variantStyles = {
    primary:
      'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-lg hover:shadow-xl',
    secondary:
      'bg-gray-800 text-white hover:bg-gray-900 focus:ring-gray-500 shadow-lg hover:shadow-xl',
    outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm gap-2',
    md: 'px-6 py-3 text-base gap-3',
    lg: 'px-8 py-4 text-lg gap-4',
  };

  // Si un style personnalisé est fourni, ne pas appliquer les variantStyles mais garder text-white
  const shouldUseVariantStyles = !style;
  const textColorClass = style ? 'text-white' : '';
  const combinedStyles = `${baseStyles} ${shouldUseVariantStyles ? variantStyles[variant] : textColorClass} ${sizeStyles[size]} ${className}`;

  const content = (
    <>
      <span className="relative z-10 translate-x-6 transition-transform duration-300 group-hover:-translate-x-0">
        {children}
      </span>
      <svg
        className={`relative z-10 h-8 w-8 -translate-x-10 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      <span
        className="absolute inset-0 -translate-x-full transform bg-gradient-to-r from-transparent via-white to-transparent opacity-0 transition-opacity duration-500 group-hover:translate-x-full group-hover:opacity-20"
        style={{ transitionDuration: '600ms' }}
        aria-hidden="true"
      />
    </>
  );

  if (href && !disabled) {
    return (
      <a
        href={href}
        className={combinedStyles}
        style={style}
        aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
        onClick={onClick}
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={combinedStyles}
      aria-label={ariaLabel}
      style={style}
      type="button"
    >
      {content}
    </button>
  );
}
