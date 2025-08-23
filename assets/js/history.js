// history.js - 거래 내역 페이지 로직 (수정 버전)

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

// 설명 포맷 함수
function formatDescription(item) {
  const typeDescriptions = {
    attendance: '출석 체크',
    homework: '과제 완료',
    test: '시험 성적',
    purchase: '상품 구매',
    deposit: '포인트 저축',
    withdraw: '포인트 인출',
    interest: '주간 이자',
    gift: '친구 선물',
    manual: '수동 지급',
  };

  // 시간 정보 추가
  const time = item.date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const desc =
    typeDescriptions[item.description] || item.description || item.type;
  return `${desc} • ${time}`;
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
          tempHistory.push({
            date: parsedDate,
            type: getTransactionType(item.type, item.amount),
            title: item.itemName || getDefaultTitle(item.type),
            amount: parseInt(item.amount) || 0,
            icon: getIconForType(item.type),
            description: item.type,
            source: 'transactions',
          });
        }
      });
    }

    console.log('📍 전체 거래 내역:', tempHistory.length + '건');

    // 정렬
    tempHistory.sort((a, b) => b.date - a.date);

    // 전체 데이터 저장
    allHistory = tempHistory;
    filteredHistory = tempHistory;

    // 화면에 표시
    displayHistory();
    updateStatistics();
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
    const container = document.getElementById('historyListContainer');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <div class="empty-title">데이터 로드 실패</div>
        <div class="empty-desc">새로고침해주세요</div>
      </div>
    `;
  } finally {
    isLoading = false;
  }
}

// 거래 내역 표시
function displayHistory() {
  console.log('📍 displayHistory 호출 - 데이터 개수:', filteredHistory.length);

  const container = document.getElementById('historyListContainer');
  if (!container) {
    console.error('❌ historyListContainer를 찾을 수 없습니다');
    return;
  }

  if (filteredHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">거래 내역이 없습니다</div>
        <div class="empty-desc">선택한 기간에 거래가 없어요</div>
      </div>
    `;
    return;
  }

  // 날짜별 그룹화
  const grouped = {};
  filteredHistory.forEach((item) => {
    const dateKey = formatDateKey(item.date);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(item);
  });

  // HTML 생성
  let html = '<div class="history-list">';

  Object.keys(grouped).forEach((dateKey) => {
    html += `<div class="date-group">${dateKey}</div>`;

    grouped[dateKey].forEach((item) => {
      const iconClass = getIconClass(item.type);
      const amountClass =
        item.amount > 0 ? 'amount-positive' : 'amount-negative';
      const amountText =
        item.amount > 0
          ? `+${Math.abs(item.amount).toLocaleString()}P`
          : `-${Math.abs(item.amount).toLocaleString()}P`;

      html += `
        <div class="history-item">
          <div class="item-left">
            <div class="item-icon ${iconClass}">
              ${item.icon}
            </div>
            <div class="item-info">
              <div class="item-title">${item.title}</div>
              <div class="item-desc">${formatDescription(item)}</div>
            </div>
          </div>
          <div class="item-right">
            <div class="item-amount ${amountClass}">${amountText}</div>
          </div>
        </div>
      `;
    });
  });

  html += '</div>';
  container.innerHTML = html;
  console.log('✅ 거래 내역 표시 완료');
}

// 통계 업데이트
function updateStatistics() {
  let totalEarn = 0;
  let totalSpend = 0;
  let totalSave = 0;

  filteredHistory.forEach((item) => {
    const amount = Math.abs(item.amount);

    if (item.type === 'earn' && item.amount > 0) {
      totalEarn += amount;
    } else if (item.type === 'spend' || item.amount < 0) {
      totalSpend += amount;
    } else if (item.type === 'save') {
      if (item.description === 'deposit') {
        totalSave += amount;
      } else if (item.description === 'withdraw') {
        totalSave -= amount;
      } else {
        totalSave += amount;
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

// 필터 적용
function applyFilters() {
  console.log('📍 필터 적용:', { currentFilter, currentPeriod });

  let filtered = [...allHistory];

  // 타입 필터
  if (currentFilter !== 'all') {
    filtered = filtered.filter((item) => {
      switch (currentFilter) {
        case 'earn':
          return item.amount > 0 && item.type === 'earn';
        case 'spend':
          return item.amount < 0 || item.type === 'spend';
        case 'save':
          return item.type === 'save';
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
