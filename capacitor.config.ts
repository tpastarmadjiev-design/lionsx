import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lionsx.app',
  appName: 'Lions-X',
  webDir: 'dist',
  server: {
    // For production, remove this block entirely.
    // For development/testing, uncomment below to load from your dev server:
    // url: 'http://192.168.1.XXX:8080',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a1a',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Lions-X',
  },
  android: {
    backgroundColor: '#1a1a1a',
  },
};

export default config;
