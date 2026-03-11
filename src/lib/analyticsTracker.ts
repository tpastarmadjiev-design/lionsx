/**
 * LIONS-X Analytics Tracker — Wave 1
 * 
 * Tracks: timezone, training sessions (start/end), streaks,
 * location preferences, share events, shop visits, first session.
 * 
 * All functions are fire-and-forget (don't block UI).
 * Errors are logged but never shown to the user.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Timezone ───

/** Get the user's timezone from the browser */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** Save timezone to user's profile (call on login/app start) */
export async function saveUserTimezone(userId: string) {
  const timezone = getUserTimezone();
  try {
    await supabase
      .from('profiles')
      .update({ timezone } as any)
      .eq('id', userId);
  } catch (err) {
    console.error('Failed to save timezone:', err);
  }
}

// ─── Training Sessions (Drop-off tracking) ───

/** Start a training session — returns session ID */
export async function startTrainingSession(
  userId: string,
  exerciseName: string,
  location?: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('training_sessions' as any)
      .insert({
        user_id: userId,
        exercise_name: exerciseName,
        location: location || 'home',
        timezone: getUserTimezone(),
        started_at: new Date().toISOString(),
        was_completed: false,
      } as any)
      .select('id')
      .single();
    
    if (error) throw error;
    return (data as any)?.id || null;
  } catch (err) {
    console.error('Failed to start training session:', err);
    return null;
  }
}

/** Complete a training session */
export async function completeTrainingSession(
  sessionId: string,
  repsAchieved: number,
  lpEarned: number,
  durationSeconds: number,
) {
  try {
    await supabase
      .from('training_sessions' as any)
      .update({
        completed_at: new Date().toISOString(),
        was_completed: true,
        reps_achieved: repsAchieved,
        lp_earned: lpEarned,
        session_duration_seconds: durationSeconds,
      } as any)
      .eq('id', sessionId);
  } catch (err) {
    console.error('Failed to complete training session:', err);
  }
}

// ─── Streaks ───

/** Update streak after a completed training session */
export async function updateStreak(userId: string) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, last_training_date')
      .eq('id', userId)
      .single();
    
    if (!profile) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastDate = (profile as any).last_training_date;
    
    // Already trained today — no streak update needed
    if (lastDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let newStreak: number;
    if (lastDate === yesterday) {
      // Consecutive day — increment streak
      newStreak = ((profile as any).current_streak || 0) + 1;
    } else {
      // Streak broken — start fresh
      newStreak = 1;
    }

    const longestStreak = Math.max(newStreak, (profile as any).longest_streak || 0);

    await supabase
      .from('profiles')
      .update({
        current_streak: newStreak,
        longest_streak: longestStreak,
        last_training_date: today,
      } as any)
      .eq('id', userId);
  } catch (err) {
    console.error('Failed to update streak:', err);
  }
}

// ─── First Session ───

/** Mark the user's first ever training session (call once) */
export async function markFirstSession(userId: string) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_session_at')
      .eq('id', userId)
      .single();
    
    // Only set if not already set
    if (profile && !(profile as any).first_session_at) {
      await supabase
        .from('profiles')
        .update({ first_session_at: new Date().toISOString() } as any)
        .eq('id', userId);
    }
  } catch (err) {
    console.error('Failed to mark first session:', err);
  }
}

// ─── Location Preference ───

/** Update preferred location based on usage */
export async function trackLocationPreference(userId: string, location: string) {
  try {
    await supabase
      .from('profiles')
      .update({ preferred_location: location } as any)
      .eq('id', userId);
  } catch (err) {
    console.error('Failed to track location preference:', err);
  }
}

// ─── Share Events ───

export type ShareType = 'result' | 'rank' | 'profile' | 'challenge' | 'referral';
export type SharePlatform = 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'whatsapp' | 'copy_link' | 'qr_code' | 'other';

/** Track when a user shares content */
export async function trackShare(userId: string, shareType: ShareType, platform: SharePlatform) {
  try {
    await supabase
      .from('share_events' as any)
      .insert({
        user_id: userId,
        share_type: shareType,
        platform,
      } as any);
  } catch (err) {
    console.error('Failed to track share:', err);
  }
}

// ─── Shop Visits ───

export type ShopSource = 'tab_button' | 'profile_link' | 'rank_reward' | 'notification' | 'other';

/** Track when a user visits the shop */
export async function trackShopVisit(userId: string, source: ShopSource): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('shop_visits' as any)
      .insert({
        user_id: userId,
        source,
      } as any)
      .select('id')
      .single();
    
    if (error) throw error;
    return (data as any)?.id || null;
  } catch (err) {
    console.error('Failed to track shop visit:', err);
    return null;
  }
}

/** Update shop visit with purchase info */
export async function trackShopPurchase(visitId: string, amount: number) {
  try {
    await supabase
      .from('shop_visits' as any)
      .update({
        made_purchase: true,
        purchase_amount: amount,
      } as any)
      .eq('id', visitId);
  } catch (err) {
    console.error('Failed to track purchase:', err);
  }
}

// ─── General Event Tracking (flexible, for anything we add later) ───

/** Track any custom event */
export async function trackEvent(userId: string, eventType: string, eventData?: Record<string, any>) {
  try {
    await supabase
      .from('app_events' as any)
      .insert({
        user_id: userId,
        event_type: eventType,
        event_data: eventData || {},
        timezone: getUserTimezone(),
      } as any);
  } catch (err) {
    console.error('Failed to track event:', err);
  }
}
