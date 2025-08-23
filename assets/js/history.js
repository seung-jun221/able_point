// history.js - 거래 내역 페이지 로직 (저축 분류 완전 분리 버전)

// ========== 전역 변수 ==========
let allHistory = [];
let filteredHistory = [];
let currentFilter = 'all';
let currentPeriod = 'month';
let studentData = null;
let isLoading = false;
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

// ========== 헬퍼 함수들 먼저 정의 ==========

// ✅ Supabase ISO 형식 날짜 파싱 함수
function parseDate(dateString) {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    if (!date || !date.getTime || isNaN(date.getTime())) {
      console.log('Invalid date:', dateString);
      return null;
    }
    return date;
  } catch (error) {
    console.error('날짜 파싱 오류:', dateString, error);
    return null;
  }
}

// 날짜 키 포맷
function formatDateKey(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;

  return date.toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

// 기본 제목 생성
function getDefaultTitle(type) {
  const titles = {
    attendance: '출석 보상',
    homework: '숙제 완료',
    test: '시험 점수',
    purchase: '상품 구매',
    deposit: '저축 입금',
    withdraw: '저축 출금',
    interest: '이자 지급',
    gift: '포인트 선물',
    manual: '수동 지급',
  };
  return titles[type] || type;
}

// 아이콘 가져오기
function getIconForType(type) {
  const icons = {
    attendance: '✅',
    homework: '📚',
    test: '💯',
    purchase: '🛍️',
    deposit: '💰',
    withdraw: '💸',
    interest: '💎',
    gift: '🎁',
    manual: '✨',
  };
  return icons[type] || '📝';
}

// 아이콘 클래스 가져오기
function getIconClass(type) {
  const classes = {
    earn: 'icon-earn',
    spend: 'icon-spend',
    save: 'icon-save',
  };
  return classes[type] || 'icon-earn';
}

// 거래 타입 결정
function getTransactionType(type, amount) {
  amount = parseInt(amount);

  if (type === 'deposit' || type === 'withdraw' || type === 'interest') {
    return 'save';
  }
  if (type === 'purchase') {
    return 'spend';
  }
  if (type === 'gift') {
    return amount > 0 ? 'earn' : 'spend';
  }
  if (amount > 0) {
    return 'earn';
  }
  return 'spend';
}

// formatDescription 함수 수정
function formatDescription(item) {
  if (item.description === 'deposit') {
    return '저축 입금 (사용 가능 포인트 감소)';
  } else if (item.description === 'withdraw') {
    return '저축 출금 (사용 가능 포인트 증가)';
  } else if (item.description === 'interest') {
    return '이자 지급';
  }

  // 기타 설명
  const descriptions = {
    attendance: '출석 체크',
    homework: '과제 제출',
    test: '시험 응시',
    purchase: '상품 구매',
    gift: '포인트 선물',
    manual: '수동 지급',
  };

  return descriptions[item.description] || item.description || '';
}

// 스켈레톤 리스트 생성
function generateSkeletonList(count) {
  let html = '<div class="history-list">';
  html += '<div class="date-group skeleton-line" style="width: 100px"></div>';

  for (let i = 0; i < count; i++) {
    html += `
      <div class="history-item skeleton">
        <div class="item-left">
          <div class="skeleton-circle"></div>
          <div class="item-info">
            <div class="skeleton-line" style="width: 150px"></div>
            <div class="skeleton-line" style="width: 100px; opacity: 0.5"></div>
          </div>
        </div>
        <div class="item-right">
          <div class="skeleton-line" style="width: 80px"></div>
          <div class="skeleton-line" style="width: 60px; opacity: 0.5"></div>
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

// ========== 메인 함수들 ==========

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const loginId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(loginId);

    if (result.success) {
      studentData = result.data;
      console.log('학생 데이터 로드:', studentData);

      // 현재 포인트 표시
      const pointsElement = document.getElementById('currentPoints');
      if (pointsElement) {
        pointsElement.textContent = `${studentData.currentPoints.toLocaleString()}P`;
      }
    } else {
      console.error('학생 데이터 로드 실패:', result.error);
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
  }
}

// 거래 타이틀 생성 (간단하게)
function getTransactionTitle(item) {
  // 저축 관련 특별 처리
  if (item.type === 'save') {
    if (item.description === 'deposit') {
      return '저축 입금';
    } else if (item.description === 'withdraw') {
      return '저축 출금';
    } else if (item.description === 'interest') {
      return '이자 지급';
    }
  }

  // 기타 거래는 기존 타이틀 사용
  return item.title || getDefaultTitle(item.description || item.type);
}

// 거래 내역 로드
async function loadHistory(loadMore = false) {
  if (isLoading) return;
  isLoading = true;

  try {
    const loginId = localStorage.getItem('loginId');
    const container = document.getElementById('historyListContainer');

    if (!loadMore) {
      container.innerHTML = generateSkeletonList(10);
    }

    console.log('📍 거래 내역 조회 시작 - loginId:', loginId);

    // API 호출
    const [pointsResult, transResult] = await Promise.all([
      api.getPointHistory(loginId),
      api.getTransactionHistory(loginId),
    ]);

    console.log('📍 API 응답:', { pointsResult, transResult });

    const tempHistory = [];

    // Points 데이터 처리
    if (pointsResult.success && pointsResult.data) {
      console.log('Points 데이터 개수:', pointsResult.data.length);

      pointsResult.data.forEach((item) => {
        const parsedDate = parseDate(item.date);
        if (parsedDate) {
          tempHistory.push({
            date: parsedDate,
            type: getTransactionType(item.type, item.amount),
            title: item.reason || getDefaultTitle(item.type),
            amount: parseInt(item.amount) || 0,
            icon: getIconForType(item.type),
            description: item.type,
            source: 'points',
          });
        }
      });
    }

    // Transactions 데이터 처리
    if (transResult.success && transResult.data) {
      console.log('Transactions 데이터 개수:', transResult.data.length);

      transResult.data.forEach((item) => {
        const parsedDate = parseDate(item.createdAt);
        if (parsedDate) {
          // 저축 관련 타이틀 간단하게 설정
          let title = item.itemName || getDefaultTitle(item.type);
          if (item.type === 'deposit') {
            title = '저축 입금';
          } else if (item.type === 'withdraw') {
            title = '저축 출금';
          } else if (item.type === 'interest') {
            title = '이자 지급';
          }

          tempHistory.push({
            date: parsedDate,
            type: getTransactionType(item.type, item.amount),
            title: title,
            amount: parseInt(item.amount) || 0,
            icon: getIconForType(item.type),
            description: item.type,
            source: 'transactions',
          });
        }
      });
    }

    // 날짜순 정렬
    tempHistory.sort((a, b) => b.date - a.date);

    allHistory = tempHistory;
    console.log('📍 전체 거래 내역:', allHistory.length, '건');

    // 필터 적용 및 표시
    applyFilters();
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
    const container = document.getElementById('historyListContainer');
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-message">데이터를 불러올 수 없습니다</div>
        <button class="retry-btn" onclick="loadHistory()">다시 시도</button>
      </div>
    `;
  } finally {
    isLoading = false;
  }
}

// displayHistory 함수 - 간소화 버전
function displayHistory() {
  const container = document.getElementById('historyListContainer');
  if (!container) return;

  if (filteredHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-message">거래 내역이 없습니다</div>
      </div>
    `;
    return;
  }

  // 날짜별 그룹화
  const groupedHistory = {};
  filteredHistory.forEach((item) => {
    const dateKey = formatDateKey(item.date);
    if (!groupedHistory[dateKey]) {
      groupedHistory[dateKey] = [];
    }
    groupedHistory[dateKey].push(item);
  });

  let html = '<div class="history-list">';

  Object.entries(groupedHistory).forEach(([dateKey, items]) => {
    html += `
      <div class="date-group">
        <div class="date-header">${dateKey}</div>
    `;

    items.forEach((item) => {
      const iconClass = getIconClass(item.type);

      // ⭐ 저축 관련 금액 표시 수정
      let amountClass, amountText;

      if (item.type === 'save') {
        // 저축 관련 거래
        if (item.description === 'deposit') {
          // 입금: 사용 가능 포인트 감소 → 빨간색 마이너스
          amountClass = 'amount-negative';
          amountText = `-${Math.abs(item.amount).toLocaleString()}P`;
        } else if (item.description === 'withdraw') {
          // 출금: 사용 가능 포인트 증가 → 초록색 플러스
          amountClass = 'amount-positive';
          amountText = `+${Math.abs(item.amount).toLocaleString()}P`;
        } else if (item.description === 'interest') {
          // 이자: 저축 계좌에 추가 → 노란색/중립 표시
          amountClass = 'amount-interest';
          amountText = `+${Math.abs(item.amount).toLocaleString()}P`;
        } else {
          // 기타 저축 관련
          amountClass = item.amount > 0 ? 'amount-positive' : 'amount-negative';
          amountText =
            item.amount > 0
              ? `+${Math.abs(item.amount).toLocaleString()}P`
              : `-${Math.abs(item.amount).toLocaleString()}P`;
        }
      } else {
        // 일반 거래 (기존 로직)
        amountClass = item.amount > 0 ? 'amount-positive' : 'amount-negative';
        amountText =
          item.amount > 0
            ? `+${Math.abs(item.amount).toLocaleString()}P`
            : `-${Math.abs(item.amount).toLocaleString()}P`;
      }

      // 타이틀 가져오기 (간단하게)
      const title = getTransactionTitle(item);

      // ⭐ 간소화된 HTML - 한 줄 표시
      html += `
        <div class="history-item">
          <div class="item-left">
            <div class="item-icon ${iconClass}">
              ${item.icon}
            </div>
            <div class="item-info">
              <div class="item-title">${title}</div>
            </div>
          </div>
          <div class="item-right">
            <div class="item-amount ${amountClass}">${amountText}</div>
          </div>
        </div>
      `;
    });

    html += '</div>';
  });

  html += '</div>';
  container.innerHTML = html;
  console.log('✅ 거래 내역 표시 완료');
}

// 통계 업데이트 - 🔥 완전히 수정된 로직
function updateStatistics() {
  let totalEarn = 0;
  let totalSpend = 0;
  let totalSave = 0;

  filteredHistory.forEach((item) => {
    const amount = Math.abs(item.amount);

    // 🔥 저축 관련 완전 분리
    if (
      item.type === 'save' ||
      item.description === 'deposit' ||
      item.description === 'withdraw' ||
      item.description === 'interest'
    ) {
      // 저축 통계만 처리
      if (item.description === 'deposit') {
        totalSave += amount; // 입금은 저축 증가
      } else if (item.description === 'withdraw') {
        totalSave -= amount; // 출금은 저축 감소
      } else if (item.description === 'interest') {
        totalSave += amount; // 이자는 저축 증가
      }
    } else {
      // 저축이 아닌 경우만 획득/사용 통계에 포함
      if (item.amount > 0) {
        totalEarn += amount; // 획득
      } else {
        totalSpend += amount; // 사용
      }
    }
  });

  // 통계 표시 업데이트
  const earnElement = document.getElementById('statEarn');
  const spendElement = document.getElementById('statSpend');
  const saveElement = document.getElementById('statSave');

  if (earnElement) earnElement.textContent = `+${totalEarn.toLocaleString()}P`;
  if (spendElement)
    spendElement.textContent = `${totalSpend.toLocaleString()}P`;
  if (saveElement)
    saveElement.textContent = `${Math.abs(totalSave).toLocaleString()}P`;
}

// 필터 적용 - 🔥 완전히 수정된 로직
function applyFilters() {
  console.log('📍 필터 적용:', { currentFilter, currentPeriod });

  let filtered = [...allHistory];

  // 타입 필터 - 🔥 완전히 수정된 로직
  if (currentFilter !== 'all') {
    filtered = filtered.filter((item) => {
      switch (currentFilter) {
        case 'earn':
          // 🔥 획득: 저축 관련 완전 제외
          return (
            item.amount > 0 &&
            item.type !== 'save' &&
            item.description !== 'deposit' &&
            item.description !== 'withdraw' &&
            item.description !== 'interest'
          );

        case 'spend':
          // 🔥 사용: 저축 관련 완전 제외
          return (
            (item.amount < 0 ||
              item.type === 'spend' ||
              item.description === 'purchase' ||
              item.description === 'transfer') &&
            item.type !== 'save' &&
            item.description !== 'deposit' &&
            item.description !== 'withdraw' &&
            item.description !== 'interest'
          );

        case 'save':
          // 저축: 저축 관련만
          return (
            item.type === 'save' ||
            item.description === 'deposit' ||
            item.description === 'withdraw' ||
            item.description === 'interest'
          );

        default:
          return true;
      }
    });
  }

  // 기간 필터
  const now = new Date();
  const periodDays = {
    week: 7,
    month: 30,
    '3month': 90,
    all: 9999,
  };

  const daysLimit = periodDays[currentPeriod] || 30;
  filtered = filtered.filter((item) => {
    if (!item.date || isNaN(item.date.getTime())) {
      return false;
    }
    const daysDiff = Math.floor((now - item.date) / (1000 * 60 * 60 * 24));
    return daysDiff <= daysLimit;
  });

  filteredHistory = filtered;
  console.log(`📍 필터링 결과: ${currentFilter} - ${filteredHistory.length}건`);

  displayHistory();
  updateStatistics();
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 필터 탭
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document
        .querySelectorAll('.filter-btn')
        .forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      applyFilters();
    });
  });

  // 기간 선택
  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document
        .querySelectorAll('.period-btn')
        .forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      currentPeriod = e.target.dataset.period;
      applyFilters();
    });
  });
}

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📍 거래 내역 페이지 초기화');

  const loginId = localStorage.getItem('loginId');
  if (!loginId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  try {
    // 데이터 로드
    await loadStudentData();
    await loadHistory();

    // 이벤트 리스너 설정
    setupEventListeners();
  } catch (error) {
    console.error('초기화 오류:', error);
  }
});
