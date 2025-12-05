import { useState, useEffect } from 'react';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export const Image = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  onError,
  ...props
}: ImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Réinitialiser l'état si la source change
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    onError?.(e);
  };

  return (
    <div className="relative w-full h-full">
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse rounded-inherit" />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        onLoad={handleLoad}
        onError={handleError}
        className={`${className} ${!isLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        {...props}
      />
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 rounded-inherit">
          <span className="text-sm">Erreur de chargement</span>
        </div>
      )}
    </div>
  );
};

