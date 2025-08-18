// cache.js - 캐싱 시스템
class CacheManager {
  constructor() {
    this.CACHE_PREFIX = 'pointbank_';
    this.CACHE_EXPIRE = 5 * 60 * 1000; // 5분
  }

  set(key, data) {
    const cacheData = {
      data: data,
      timestamp: Date.now(),
    };
    localStorage.setItem(this.CACHE_PREFIX + key, JSON.stringify(cacheData));
  }

  get(key) {
    const cached = localStorage.getItem(this.CACHE_PREFIX + key);
    if (!cached) return null;

    try {
      const { data, timestamp } = JSON.parse(cached);
      // 만료 시간 체크
      if (Date.now() - timestamp > this.CACHE_EXPIRE) {
        this.remove(key);
        return null;
      }
      return data;
    } catch (error) {
      console.error('캐시 파싱 오류:', error);
      return null;
    }
  }

  remove(key) {
    localStorage.removeItem(this.CACHE_PREFIX + key);
  }

  clear() {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(this.CACHE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  }
}

const cache = new CacheManager();
