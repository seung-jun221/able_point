// config.js - Supabase 설정
const SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: 'YOUR_ANON_KEY',

  // 선택적: 추가 설정
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
};

// 환경별 설정
const ENV = {
  development: {
    apiUrl: 'http://localhost:3000',
    debug: true,
  },
  production: {
    apiUrl: 'https://your-app.com',
    debug: false,
  },
};

// 현재 환경
const currentEnv = 'development';
