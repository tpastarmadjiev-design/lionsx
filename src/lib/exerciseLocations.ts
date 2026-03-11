// Maps exercise names to the training locations where they're available.
// Exercises not listed here default to ['home'].

export type TrainingLocation = 'home' | 'street' | 'gym';

// Dumbbell exercises appear in both Home and Gym
const DUMBBELL_EXERCISES = [
  'Dumbbell Bicep Curls',
  'Dumbbell Hammer Curls',
  'Dumbbell Shoulder Press',
  'Dumbbell Lateral Raises',
  'Dumbbell Front Raises',
  'Dumbbell Bent-over Rows',
  'Dumbbell Goblet Squat',
  'Dumbbell Thrusters',
  'Dumbbell Chest Press',
  'Dumbbell Tricep Overhead Extension',
  'Dumbbell Punches',
  'Deadlift',
  'Dumbbell Windmill',
];

// Street-specific exercises (calisthenics / outdoor)
const STREET_EXERCISES = [
  'Pull-ups',
  'Dips',
  'Push-ups',
  'Diamond Push-ups',
  'Pike Push-ups',
  'Burpees',
  'Mountain Climbers',
  'Jumping Jacks',
  'High Knees',
  'Jump Rope',
  'Lunges',
  'Squats',
  'Calf Raises',
  'Running',
  'Cycling',
];

// Gym-only exercises (heavy equipment / machines)
const GYM_ONLY_EXERCISES = [
  'Bench Press',
  'Treadmill Run',
  'Lat Pulldown',
  'Seated Cable Row',
];

// Home exercises = bodyweight + mobility + dumbbell
const HOME_BODYWEIGHT = [
  'Push-ups',
  'Diamond Push-ups',
  'Pike Push-ups',
  'Squats',
  'Lunges',
  'Calf Raises',
  'Burpees',
  'Mountain Climbers',
  'Jumping Jacks',
  'High Knees',
  'Jump Rope',
  'Jumps',
  'Sit-ups',
  'Plank',
  'Wall Sit',
];

const HOME_MOBILITY = [
  'Cat-Cow Stretch',
  'Cobra Stretch',
  'Deep Squat Hold',
  'Hip Circles',
  'Shoulder Stretch Hold',
  'Toe Touches',
];

const locationMap: Record<string, TrainingLocation[]> = {};

// Home bodyweight
HOME_BODYWEIGHT.forEach(name => {
  locationMap[name] = [...(locationMap[name] || []), 'home'];
});

// Home mobility
HOME_MOBILITY.forEach(name => {
  locationMap[name] = [...(locationMap[name] || []), 'home'];
});

// Dumbbell → home + gym
DUMBBELL_EXERCISES.forEach(name => {
  locationMap[name] = ['home', 'gym'];
});

// Street exercises
STREET_EXERCISES.forEach(name => {
  if (!locationMap[name]) locationMap[name] = [];
  if (!locationMap[name].includes('street')) locationMap[name].push('street');
});

// Gym-only
GYM_ONLY_EXERCISES.forEach(name => {
  locationMap[name] = [...(locationMap[name] || []), 'gym'];
});

// Also add dumbbell exercises to gym
// (already done above)

export function getExerciseLocations(exerciseName: string): TrainingLocation[] {
  return locationMap[exerciseName] || ['home'];
}

export function filterExercisesByLocation<T extends { name: string }>(
  exercises: T[],
  location: TrainingLocation
): T[] {
  return exercises.filter(ex => getExerciseLocations(ex.name).includes(location));
}
