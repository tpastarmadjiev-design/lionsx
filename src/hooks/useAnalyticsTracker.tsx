import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'web';
}

function getScreenResolution(): string {
  return `${window.screen.width}x${window.screen.height}`;
}

export function useAnalyticsTracker() {
  const { user } = useAuth();

  const trackScreenView = useCallback(async (screenName: string) => {
    if (!user?.id) return;

    try {
      await supabase.from('user_analytics').insert({
        user_id: user.id,
        device_type: getDeviceType(),
        screen_resolution: getScreenResolution(),
        screen_name: screenName,
      });
    } catch (error) {
      console.error('Failed to track screen view:', error);
    }
  }, [user?.id]);

  return { trackScreenView };
}

export function useTrackScreen(screenName: string) {
  const { trackScreenView } = useAnalyticsTracker();

  useEffect(() => {
    trackScreenView(screenName);
  }, [screenName, trackScreenView]);
}
