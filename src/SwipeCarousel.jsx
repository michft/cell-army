import { useRef, useState } from 'react';

const SCREEN_IDS = ['qr', 'browse', 'calendar-day1', 'calendar-day2'];

/**
 * @param {{
 *   screenIndex: number,
 *   onChangeScreen: (nextIndex: number) => void,
 *   children: import("react").ReactNode
 * }} props
 */
export default function SwipeCarousel({ screenIndex, onChangeScreen, children }) {
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const [isAnimating, setIsAnimating] = useState(false);

  /** @param {import("react").TouchEvent<HTMLDivElement>} event */
  function handleTouchStart(event) {
    if (isAnimating) return;
    touchStartX.current = event.changedTouches[0].clientX;
    touchStartTime.current = Date.now();
  }

  /** @param {import("react").TouchEvent<HTMLDivElement>} event */
  function handleTouchEnd(event) {
    if (isAnimating) return;

    const touchEndX = event.changedTouches[0].clientX;
    const distance = touchEndX - touchStartX.current;
    const timeDelta = Date.now() - touchStartTime.current;

    // Swipe threshold: 60px or 10% of screen width
    const screenWidth = window.innerWidth;
    const threshold = Math.max(60, screenWidth * 0.1);

    // Velocity threshold: if swipe is fast, use lower distance threshold
    const isQuickSwipe = timeDelta < 300 && Math.abs(distance) > 30;

    if (Math.abs(distance) < threshold && !isQuickSwipe) {
      return;
    }

    setIsAnimating(true);
    const direction = distance < 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(SCREEN_IDS.length - 1, screenIndex + direction));

    if (nextIndex !== screenIndex) {
      onChangeScreen(nextIndex);
    }

    setTimeout(() => setIsAnimating(false), 400);
  }

  return (
    <div
      ref={containerRef}
      className="swipe-carousel"
      style={{
        transform: `translateX(calc(-100% * ${screenIndex}))`,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}
