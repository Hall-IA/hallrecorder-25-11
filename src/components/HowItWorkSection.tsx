import { useEffect, useState } from 'react';

export interface ListItem {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  alt: string;
  keywords: string[];
  category: string;
  icon?: string;
}

interface ItemCarouselProps {
  items: ListItem[];
  brandColor?: string;
}

export default function HowItWorkSection({ items, brandColor = '#f97316' }: ItemCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const currentItem = items[currentIndex];

  const getCircularIndex = (index: number) => {
    if (index < 0) return items.length + index;
    if (index >= items.length) return index - items.length;
    return index;
  };

  // Autoplay effect
  useEffect(() => {
    if (isPaused || isAnimating) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setCurrentIndex((prev) => getCircularIndex(prev + 1));
      setTimeout(() => setIsAnimating(false), 800);
    }, 6000); // Change toutes les 6 secondes

    return () => clearInterval(interval);
  }, [isPaused, isAnimating, items.length]);

  const getVisibleItems = () => {
    const prevIndex = getCircularIndex(currentIndex - 1);
    const nextIndex = getCircularIndex(currentIndex + 1);

    return [
      { item: items[prevIndex], index: prevIndex, position: 'prev' },
      { item: items[currentIndex], index: currentIndex, position: 'current' },
      { item: items[nextIndex], index: nextIndex, position: 'next' },
    ];
  };

  const visibleItems = getVisibleItems();

  const goToIndex = (index: number) => {
    if (isAnimating || index === currentIndex) return;
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 800);
  };

  const handleNext = () => {
    goToIndex(getCircularIndex(currentIndex + 1));
  };

  const handlePrev = () => {
    goToIndex(getCircularIndex(currentIndex - 1));
  };

  const getImageStyle = (position: string) => {
    switch (position) {
      case 'current':
        return {
          flex: '0 0 70%',
          transform: 'scale(1) translateY(0)',
          opacity: 1,
          zIndex: 10,
          filter: 'grayscale(0)',
        };
      case 'prev':
        return {
          flex: '0 0 20%',
          transform: 'scale(0.9) translateY(0)',
          opacity: 0.6,
          zIndex: 5,
          filter: 'grayscale(0.5)',
        };
      case 'next':
        return {
          flex: '0 0 20%',
          transform: 'scale(0.9) translateY(0)',
          opacity: 0.6,
          zIndex: 5,
          filter: 'grayscale(0.5)',
        };
      default:
        return {
          flex: '0 0 20%',
          transform: 'scale(0.9)',
          opacity: 0.5,
          zIndex: 1,
          filter: 'grayscale(0.7)',
        };
    }
  };

  return (
    <section
      className="font-roboto flex w-full flex-col items-center gap-20 py-10 lg:h-[70vh] lg:mt-10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex flex-col items-center gap-4 px-2">
        <h3 className="font-thunder text-5xl font-medium">Comment ça marche ?</h3>
        <p className="text-center text-lg">HALL RECORDER, l'outil qui transforme vos réunions et vos notes vocales en décisions concrètes.</p>
      </div>

      {/* Desktop Version */}
      <div className="mx-auto hidden h-full max-w-7xl px-6 lg:flex lg:items-center lg:gap-8">
        {/* Images Column */}
        <div className="flex h-full w-[60%] gap-6">
          <div className="relative flex flex-1 flex-col gap-4">
            {visibleItems.map(({ item, index, position }) => {
              const isActive = position === 'current';
              const imageStyle = getImageStyle(position);

              return (
                <button
                  key={`${item.id}-${index}`}
                  onClick={() => goToIndex(index)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl shadow-2xl"
                  style={{
                    flex: imageStyle.flex,
                    opacity: imageStyle.opacity,
                    transform: imageStyle.transform,
                    zIndex: imageStyle.zIndex,
                    filter: imageStyle.filter,
                    transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  aria-label={isActive ? `Image actuelle: ${item.title}` : `Aller à ${item.title}`}
                  aria-current={isActive}
                  disabled={isAnimating}
                >
                  <img
                    src={item.videoUrl}
                    alt={isActive ? item.alt : ''}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {!isActive && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation Buttons */}
          <nav className="flex w-[10%] flex-col items-center justify-center gap-6">
            <button
              onClick={handlePrev}
              disabled={isAnimating}
              className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{ backgroundColor: brandColor }}
              aria-label="Élément précédent"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 15L12 9L6 15" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={isAnimating}
              className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{ backgroundColor: brandColor }}
              aria-label="Élément suivant"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="rotate-180"
              >
                <path d="M18 15L12 9L6 15" />
              </svg>
            </button>
          </nav>
        </div>

        {/* Content Column */}
        <article className="flex w-[40%] flex-col justify-center">
          <div key={`content-${currentIndex}`} className="space-y-8">
            <div className="flex items-start gap-6">
              <div
                className="content-animate content-icon flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-white shadow-xl"
                style={{ backgroundColor: brandColor }}
              >
                <span className="text-3xl font-bold">{currentIndex + 1}</span>
              </div>
              <div>
                <h2 className="content-animate content-title font-thunder mb-4 text-5xl leading-tight font-medium text-gray-900">
                  {currentItem.title}
                </h2>
                <p className="content-animate content-desc font-roboto text-lg leading-relaxed text-gray-600 whitespace-pre-line">
                  {currentItem.description}
                </p>
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* Mobile version */}

      <div className="flex flex-col items-center justify-center px-6 lg:hidden">
        {/* Images carousel */}
        <div className="relative mb-6 w-full">
          <div className="flex items-center justify-center gap-2">
            {/* Image précédente */}
            <div className="w-[10%]">
              <button
                onClick={handlePrev}
                className="relative block overflow-hidden rounded-lg opacity-40 shadow-lg transition-all duration-300 hover:opacity-70 active:scale-95"
                aria-label="Élément précédent"
                disabled={isAnimating}
              >
                <img
                  src={items[getCircularIndex(currentIndex - 1)].videoUrl}
                  alt=""
                  className="aspect-video h-auto w-full object-cover grayscale"
                />
              </button>
            </div>

            {/* Image centrale */}
            <article className="w-[80%]">
              <div className="overflow-hidden rounded-2xl shadow-2xl">
                <img
                  src={currentItem.videoUrl}
                  alt={currentItem.alt}
                  className="aspect-video h-auto w-full object-cover transition-transform duration-500"
                />
              </div>
            </article>

            {/* Image suivante */}
            <div className="w-[10%]">
              <button
                onClick={handleNext}
                className="relative block overflow-hidden rounded-lg opacity-40 shadow-lg transition-all duration-300 hover:opacity-70 active:scale-95"
                aria-label="Élément suivant"
                disabled={isAnimating}
              >
                <img
                  src={items[getCircularIndex(currentIndex + 1)].videoUrl}
                  alt=""
                  className="aspect-video h-auto w-full object-cover grayscale"
                />
              </button>
            </div>
          </div>
        </div>

        <nav className="mb-8 flex justify-center gap-4">
          <button
            onClick={handlePrev}
            disabled={isAnimating}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:shadow-xl active:scale-95"
            style={{ backgroundColor: brandColor }}
            aria-label="Élément précédent"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18L9 12L15 6" />
            </svg>
          </button>
          <button
            onClick={handleNext}
            disabled={isAnimating}
            className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 hover:shadow-xl active:scale-95"
            style={{ backgroundColor: brandColor }}
            aria-label="Élément suivant"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18L15 12L9 6" />
            </svg>
          </button>
        </nav>

        <div key={`mobile-content-${currentIndex}`} className="flex items-center justify-center">
          <div className="flex max-w-[80%] items-start gap-3">
            <div
              className="content-animate content-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
              style={{ backgroundColor: brandColor }}
            >
              <span className="text-lg font-bold">{currentIndex + 1}</span>
            </div>
            <div>
              <h2 className="content-animate content-title font-thunder mb-1 text-3xl font-medium text-gray-900">
                {currentItem.title}
              </h2>
              <p className="content-animate content-desc font-roboto text-sm text-gray-600 whitespace-pre-line">
                {currentItem.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
