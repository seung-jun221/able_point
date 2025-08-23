// navigation.js - 수정된 버전

// 헤더 포인트 업데이트 함수 (완전한 버전)
async function updateHeaderPoints() {
  // ID와 클래스 모두 체크
  const pointsElement =
    document.querySelector('#headerTotalPoints') ||
    document.querySelector('.header-points-value');

  if (!pointsElement) {
    console.error('포인트 표시 요소를 찾을 수 없습니다');
    return;
  }

  try {
    const loginId = localStorage.getItem('loginId');

    if (!loginId) {
      console.warn('로그인 ID가 없습니다');
      pointsElement.textContent = '0P';
      return;
    }

    // API를 통해 실제 포인트 가져오기
    if (typeof api !== 'undefined' && api.getStudentPoints) {
      const result = await api.getStudentPoints(loginId);

      if (result.success && result.data) {
        const currentPoints = result.data.currentPoints || 0;
        const formattedPoints = currentPoints.toLocaleString() + 'P';

        // 값이 변경되었을 때만 업데이트
        if (pointsElement.textContent !== formattedPoints) {
          pointsElement.textContent = formattedPoints;
          pointsElement.classList.add('updated');

          // localStorage에도 저장 (캐싱용)
          localStorage.setItem('currentPoints', currentPoints);

          // 애니메이션 후 클래스 제거
          setTimeout(() => {
            pointsElement.classList.remove('updated');
          }, 600);
        }

        console.log('포인트 업데이트 성공:', formattedPoints);
      } else {
        console.error('API 응답 실패:', result.error);
        // localStorage에서 백업 데이터 사용
        const cachedPoints = localStorage.getItem('currentPoints') || '0';
        pointsElement.textContent =
          parseInt(cachedPoints).toLocaleString() + 'P';
      }
    } else {
      // API가 없을 경우 localStorage 사용
      const currentPoints = localStorage.getItem('currentPoints') || '0';
      const formattedPoints = parseInt(currentPoints).toLocaleString() + 'P';
      pointsElement.textContent = formattedPoints;
    }
  } catch (error) {
    console.error('포인트 업데이트 실패:', error);

    // 에러 시 localStorage 백업 사용
    const cachedPoints = localStorage.getItem('currentPoints') || '0';
    pointsElement.textContent = parseInt(cachedPoints).toLocaleString() + 'P';
  }
}

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

  navItems.forEach((item) => item.classList.remove('active'));

  let activeFound = false;
  navItems.forEach((item) => {
    const href = item.getAttribute('href') || item.dataset.page;

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

  if (!activeFound && navItems.length > 0) {
    navItems[0].classList.add('active');
  }
}

// 알림 확인
function checkNotifications() {
  const badge = document.querySelector('.notification-badge');
  if (!badge) return;

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
  event.currentTarget.classList.add('nav-loading');

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

// 유틸리티: 짧은 포인트 표시
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
  console.log('Navigation 초기화 시작');

  // 초기화
  initNavigation();

  // 즉시 포인트 업데이트 (페이지 로드 시)
  updateHeaderPoints();

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

// 디버그용 - 콘솔에서 테스트 가능
window.debugUpdatePoints = function (points) {
  localStorage.setItem('currentPoints', points);
  updateHeaderPoints();
  console.log('포인트가 ' + points + '로 설정되었습니다');
};
