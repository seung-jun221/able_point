/* ========================================
   NAVIGATION HELPER FUNCTIONS
   네비게이션 동작을 위한 헬퍼 함수들
   ======================================== */

// 네비게이션 초기화
function initNavigation() {
  // 현재 페이지 감지 및 활성화
  setActiveNavItem();

  // 포인트 실시간 업데이트
  updateHeaderPoints();

  // 알림 체크
  checkNotifications();

  // 스크롤 이벤트 (헤더 축소)
  initScrollEffect();
}

// 현재 페이지에 맞는 네비게이션 아이템 활성화
function setActiveNavItem() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.nav-item');

  // 모든 active 클래스 제거
  navItems.forEach((item) => item.classList.remove('active'));

  // 현재 페이지 매칭
  let activeFound = false;
  navItems.forEach((item) => {
    const href = item.getAttribute('href') || item.dataset.page;

    // 경로 매칭 로직
    if (currentPath.includes('index.html') || currentPath.endsWith('/')) {
      if (href === 'index.html' || href === 'home') {
        item.classList.add('active');
        activeFound = true;
      }
    } else if (
      currentPath.includes(href) ||
      currentPath.includes(item.dataset.page)
    ) {
      item.classList.add('active');
      activeFound = true;
    }
  });

  // 매칭되는 항목이 없으면 홈 활성화
  if (!activeFound && navItems.length > 0) {
    navItems[0].classList.add('active');
  }
}

// 헤더 포인트 업데이트
async function updateHeaderPoints() {
  const pointsElement = document.querySelector('.header-points-value');
  if (!pointsElement) return;

  try {
    // localStorage에서 포인트 가져오기 (실제로는 API 호출)
    const studentId = localStorage.getItem('loginId');
    if (!studentId) return;

    // API 호출 시뮬레이션 (실제 코드에서는 api.js 사용)
    const currentPoints = localStorage.getItem('currentPoints') || '0';

    // 포인트 표시 업데이트
    const formattedPoints = parseInt(currentPoints).toLocaleString() + 'P';

    // 값이 변경되었을 때만 업데이트
    if (pointsElement.textContent !== formattedPoints) {
      pointsElement.textContent = formattedPoints;
      pointsElement.classList.add('updated');

      // 애니메이션 후 클래스 제거
      setTimeout(() => {
        pointsElement.classList.remove('updated');
      }, 600);
    }
  } catch (error) {
    console.error('포인트 업데이트 실패:', error);
  }
}

// 알림 확인
function checkNotifications() {
  const badge = document.querySelector('.notification-badge');
  if (!badge) return;

  // localStorage에서 알림 수 확인 (실제로는 API 호출)
  const unreadCount = localStorage.getItem('unreadNotifications') || '0';

  if (parseInt(unreadCount) > 0) {
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// 스크롤 시 헤더 효과
function initScrollEffect() {
  const header = document.querySelector('.app-header');
  if (!header) return;

  let lastScroll = 0;

  window.addEventListener(
    'scroll',
    () => {
      const currentScroll = window.pageYOffset;

      // 스크롤 다운: 헤더 축소
      if (currentScroll > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }

      lastScroll = currentScroll;
    },
    { passive: true }
  );
}

// 네비게이션 아이템 클릭 처리
function handleNavClick(page) {
  // 로딩 상태 표시
  event.currentTarget.classList.add('nav-loading');

  // 페이지 이동 (약간의 딜레이로 부드러운 전환)
  setTimeout(() => {
    switch (page) {
      case 'home':
        window.location.href = 'index.html';
        break;
      case 'savings':
        window.location.href = 'savings.html';
        break;
      case 'shop':
        window.location.href = 'shop.html';
        break;
      case 'ranking':
        window.location.href = 'ranking.html';
        break;
      case 'profile':
        window.location.href = 'profile.html';
        break;
    }
  }, 200);
}

// 헤더 포인트 클릭 시
function handlePointsClick() {
  window.location.href = 'history.html';
}

// 알림 클릭 시
function handleNotificationClick() {
  // 알림 페이지로 이동 또는 모달 표시
  window.location.href = 'notifications.html';
}

// 뒤로가기 버튼
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

// 유틸리티: 포인트 포맷팅
function formatPoints(points) {
  return parseInt(points).toLocaleString() + 'P';
}

// 유틸리티: 짧은 포인트 표시 (1.2K, 10.5K 등)
function formatPointsShort(points) {
  const num = parseInt(points);
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num + 'P';
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();

  // 5초마다 포인트 업데이트 (실시간 동기화)
  setInterval(updateHeaderPoints, 5000);

  // 10초마다 알림 체크
  setInterval(checkNotifications, 10000);
});

// 페이지 포커스 시 업데이트
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updateHeaderPoints();
    checkNotifications();
  }
});
