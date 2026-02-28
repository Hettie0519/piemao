import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.piemao.game',
  appName: '踹牌',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
