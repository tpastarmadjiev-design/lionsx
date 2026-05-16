import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageView } from '@/lib/gtag';

const PAGE_TITLES: Record<string, string> = {
  '/': "Lion's Den — Home",
  '/dashboard': "Dashboard — Lion's Den",
  '/training': "Training — Lion's Den",
  '/profile': "Profile — Lion's Den",
  '/ranks': "Ranks — Lion's Den",
  '/auth': "Sign In — Lion's Den",
  '/admin': "Admin — Lion's Den",
};

export function usePageViewTracking() {
  const location = useLocation();

  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] ?? "Lion's Den";
    document.title = title;
    pageView(location.pathname + location.search, title);
  }, [location]);
}
