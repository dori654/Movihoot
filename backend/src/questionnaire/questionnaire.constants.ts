// Single source of truth for the questionnaire option values — must stay in
// sync with the option lists rendered in frontend/src/pages/Questionnaire.tsx
export const MOOD_VALUES = [
  'happy',
  'tired',
  'adventurous',
  'romantic',
  'tense',
] as const;

export const GENRE_VALUES = [
  'אקשן',
  'קומדיה',
  'דרמה',
  'אימה',
  'מד"ב',
  'רומנטיקה',
  'תיעודי',
] as const;

export const FILM_CARDS_COUNT = 5;
