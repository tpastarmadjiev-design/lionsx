// ============================================================
// Google Analytics 4 (GA4) utility
// Replace G-XXXXXXXXXX with your real Measurement ID
// ============================================================

export const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// ── Page Views ──────────────────────────────────────────────
export function pageView(url: string, title?: string) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
    page_title: title,
  });
}

// ── Custom Events ────────────────────────────────────────────
export function trackEvent(
  action: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', action, params);
}

// ── Predefined training events ───────────────────────────────
export const gaEvents = {
  // Auth
  signUp: (method = 'email') =>
    trackEvent('sign_up', { method }),
  login: (method = 'email') =>
    trackEvent('login', { method }),
  logout: () =>
    trackEvent('logout'),

  // Training
  locationSelected: (location: string) =>
    trackEvent('training_location_selected', { location }),
  exerciseSelected: (exerciseName: string, location: string) =>
    trackEvent('exercise_selected', { exercise_name: exerciseName, location }),
  trainingStarted: (exerciseName: string) =>
    trackEvent('training_started', { exercise_name: exerciseName }),
  trainingCompleted: (exerciseName: string, reps: number, lpEarned: number) =>
    trackEvent('training_completed', {
      exercise_name: exerciseName,
      reps_completed: reps,
      lp_earned: lpEarned,
    }),
  trainingCancelled: (exerciseName: string) =>
    trackEvent('training_cancelled', { exercise_name: exerciseName }),

  // Navigation
  screenView: (screenName: string) =>
    trackEvent('screen_view', { screen_name: screenName }),

  // Profile
  profileUpdated: () =>
    trackEvent('profile_updated'),
  avatarUploaded: () =>
    trackEvent('avatar_uploaded'),

  // Ranks
  rankAchieved: (rankName: string, lp: number) =>
    trackEvent('rank_achieved', { rank_name: rankName, lp_total: lp }),
};
