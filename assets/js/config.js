// config.js - Supabase 설정 (환경별 분리)

// 실제 값으로 교체하세요
const SUPABASE_CONFIG = {
  url: 'https://wdravtbwtocieprqrjfc.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcmF2dGJ3dG9jaWVwcnFyamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTA3NDQsImV4cCI6MjA3MTQyNjc0NH0.s5xtRzKsx3H21hIZUtPy366s-TYrEFLdkOeTwW6Qs-o',
};

// 환경 감지 (localhost는 개발, 나머지는 프로덕션)
const ENV =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
    ? 'development'
    : 'production';

// 환경별 추가 설정
const ENV_CONFIG = {
  development: {
    debug: true,
    logLevel: 'verbose',
    apiUrl: 'http://localhost:3000',
    enableDevTools: true,
  },
  production: {
    debug: false,
    logLevel: 'error',
    apiUrl: 'https://pointbank.ablelearning.co.kr',
    enableDevTools: false,
  },
};

// 현재 환경 설정
const currentConfig = ENV_CONFIG[ENV];

// 디버그 로깅 함수
function debugLog(message, data = null) {
  if (currentConfig.debug) {
    console.log(`[PointBank ${ENV}] ${message}`, data || '');
  }
}

// 설정 내보내기
window.POINTBANK_CONFIG = {
  supabase: SUPABASE_CONFIG,
  env: ENV,
  ...currentConfig,
  debugLog,
};
