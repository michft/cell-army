import React, { useRef, useState } from 'react';

const ANIMATION_DURATION_MS = 400;

/**
 * Render a horizontal swipeable carousel that changes the active screen in response to touch gestures.
 *
 * @param {{screenIndex: number, onChangeScreen: (nextIndex: number) => void, children: import("react").ReactNode}} props
 * @param {number} props.screenIndex - Current active screen index used to translate the carousel.
 * @param {(nextIndex: number) => void} props.onChangeScreen - Called with the resolved next screen index when a swipe changes screens.
 * @param {import("react").ReactNode} props.children - Content rendered inside the carousel.
 * @returns {JSX.Element} A container div that handles touch start/end events to detect swipes and translates its children according to `screenIndex`.
 */
export default function SwipeCarousel({ screenIndex, onChangeScreen, children }) {
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const screenCount = React.Children.toArray(children).length;

  /**
   * Initialise the touch start X position and start time for swipe detection; no-op if an animation is in progress.
   * @param {import("react").TouchEvent<HTMLDivElement>} event - Touch event whose first changed touch's `clientX` is recorded as the start position and whose timestamp is recorded.
   */
  function handleTouchStart(event) {
    if (isAnimating) return;
    touchStartX.current = event.changedTouches[0].clientX;
    touchStartTime.current = Date.now();
  }

  /**
   * Handle the end of a touch gesture and resolve it into a carousel screen change.
   *
   * Calculates touch distance and duration, applies a distance threshold (60px or 10% of screen width)
   * with a relaxed rule for quick swipes, and, if the gesture qualifies as a swipe, locks animation state,
   * computes the next screen index (clamped to available screens) and invokes the `onChangeScreen` callback
   * when the index changes. Clears the animation lock after 400ms.
   *
   * @param {import("react").TouchEvent<HTMLDivElement>} event - The touchend event from the carousel container.
   */
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
    const nextIndex = Math.max(0, Math.min(screenCount - 1, screenIndex + direction));

    if (nextIndex !== screenIndex) {
      onChangeScreen(nextIndex);
    }

    setTimeout(() => setIsAnimating(false), ANIMATION_DURATION_MS);
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
