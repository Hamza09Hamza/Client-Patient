import Image from "next/image";

/**
 * The login panel's living half: real photographs of a working diagnostic
 * laboratory, crossfading behind a marine duotone.
 *
 * Three deliberate choices:
 *
 * 1. Pure CSS. The whole reel is `animation-delay` on a shared keyframe —
 *    no state, no effects, no JS at all. It runs before hydration and keeps
 *    running if hydration never happens, which matters on a login page that
 *    is the first thing a patient loads on a phone.
 *
 * 2. Duotone, not raw stock. Each frame is desaturated to luminance and then
 *    re-tinted marine via `mix-blend-color`. Five photos shot in five
 *    different rooms under five different lights would otherwise read as a
 *    stock carousel; collapsed onto the brand hue they read as one clinic.
 *
 * 3. Slow. A 40s cycle, ~8s a frame. This sits behind sign-in copy — it
 *    should be noticed on the second glance, not the first.
 *
 * Photographs are Unsplash-licensed (free for commercial use); see
 * public/lab/CREDITS.md. They are stand-ins — replace them with photographs
 * of Clinique Amina's own laboratory when those exist.
 */

const FRAMES = [
  { src: "/lab/pipetting.jpg", position: "50% 45%" },
  { src: "/lab/analyser.jpg", position: "50% 40%" },
  { src: "/lab/glassware.jpg", position: "50% 50%" },
  { src: "/lab/microscope.jpg", position: "45% 55%" },
  { src: "/lab/samples.jpg", position: "50% 50%" },
];

/** Seconds each frame holds; the full cycle is FRAMES.length × this. */
const HOLD = 8;

export function LabReel({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-0 isolate overflow-hidden ${className ?? ""}`}>
      {FRAMES.map(({ src, position }, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 55vw"
          priority={i === 0}
          className="animate-lab-reel object-cover opacity-0 filter-[grayscale(1)_contrast(1.12)_brightness(1.08)]"
          style={{ objectPosition: position, animationDelay: `${i * HOLD}s` }}
        />
      ))}
      {/* Luminance from the photograph, hue from the brand. */}
      <div className="absolute inset-0 bg-primary mix-blend-color" />
      {/* Legibility scrim — heaviest at the lower left, where the hero and
          the certification strip sit. */}
      <div className="absolute inset-0 bg-linear-to-tr from-primary-abyss via-primary-abyss/80 to-primary-deep/40" />
    </div>
  );
}
