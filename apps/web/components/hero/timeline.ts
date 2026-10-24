/**
 * Shared story for both hero animations (SVG on phones, 3D on desktop), as
 * fractions of one loop. Keeping them in one place makes the two versions
 * play the same scene.
 */
export const LOOP_SECONDS = 10;

/** Height of the animation strip (behind the text on laptops, its own row on phones). */
export const HERO_ANIMATION_HEIGHT = "clamp(190px, 30vw, 320px)";

/** The strip itself is drawn at full strength; components/home/hero.module.css fades it per layout. */
export const HERO_ANIMATION_OPACITY = 1;

export const T = {
  walkInEnd: 0.34, // robot arrives at the vault with the files
  doorOpen: [0.36, 0.44] as const,
  throwFiles: [0.46, 0.56] as const,
  doorClose: [0.56, 0.64] as const,
  dialSpin: [0.64, 0.73] as const, // light turns green at the end
  celebrate: [0.74, 0.84] as const, // two happy hops
  walkOut: [0.84, 1] as const,
};
