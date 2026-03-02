import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.piemao.game',
  appName: '踹牌',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    cleartext: true,
    url: 'https://hettie0519.github.io/piemao/',
    allowNavigation: ['*']
  }
};

export default config;
