// history.js - 심플한 리스트형 거래 내역 페이지 로직

// ========== 전역 변수 ==========
let allHistory = [];
let filteredHistory = [];
let currentFilter = 'all';
let currentPeriod = 'month';
let studentData = null;
let isLoading = false;

// ========== 동적 높이 조정 함수 추가 (여기!) ==========
function adjustContainerPadding() {
  const fixedTop = document.querySelector('.history-fixed-top');
  const container = document.querySelector('.history-container');
  const appHeader = document.querySelector('.app-header');

  if (fixedTop && container && appHeader) {
    // 고정 영역의 실제 높이 계산
    const headerHeight = appHeader.offsetHeight || 65;
    const fixedTopHeight = fixedTop.offsetHeight;
    const totalHeight = headerHeight + fixedTopHeight - 60; // 20px 여유 공간

    // 컨테이너의 padding-top 동적 설정
    container.style.paddingTop = totalHeight + 'px';

    console.log('📏 높이 조정:', {
      headerHeight,
      fixedTopHeight,
      totalHeight,
    });
  }
}

// ========== 헬퍼 함수들 ==========

// Supabase ISO 형식 날짜 파싱
function parseDate(dateString) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (!date || !date.getTime || isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch (error) {
    console.error('날짜 파싱 오류:', dateString, error);
    return null;
  }
}

// handleNavClick 함수 추가 (navigation.js와 호환)
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

// 날짜/시간 포맷 (MM.DD HH:mm)
function formatDateTime(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '-';
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${month}.${day} ${hours}:${minutes}`;
}

// 날짜 포맷 (YYYY.MM.DD)
function formatDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '-';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

// 거래 설명 포맷
function formatDescription(item) {
  // 저축 관련 처리
  if (
    item.type === 'save' ||
    item.description === 'deposit' ||
    item.description === 'withdraw' ||
    item.description === 'interest'
  ) {
    if (item.description === 'deposit') {
      return '저축 입금';
    } else if (item.description === 'withdraw') {
      return '저축 출금';
    } else if (item.description === 'interest') {
      return '이자 지급';
    }
  }

  // 우선순위: title > itemName > reason > 기본값
  if (item.title) return item.title;
  if (item.itemName) return item.itemName;
  if (item.reason) return item.reason;

  const descriptions = {
    attendance: '출석 체크',
    homework: '과제 제출',
    test: '시험 응시',
    purchase: '상품 구매',
    gift: '포인트 선물',
    manual: '수동 지급',
  };

  return (
    descriptions[item.description] ||
    descriptions[item.type] ||
    item.description ||
    '포인트 거래'
  );
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
  return titles[type] || type || '포인트 거래';
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

// ========== 메인 함수들 ==========

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const loginId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(loginId);

    if (result.success) {
      studentData = result.data;

      // 헤더 업데이트
      document.getElementById('userName').textContent =
        studentData.name || '학생';
      document.getElementById('userAvatar').textContent =
        studentData.avatar || '🦁';
      document.getElementById(
        'headerTotalPoints'
      ).textContent = `${studentData.currentPoints.toLocaleString()}P`;
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
  }
}

// 거래 내역 로드
async function loadHistory() {
  if (isLoading) return;
  isLoading = true;

  const container = document.getElementById('historyListContainer');
  container.innerHTML = generateSkeletonList(5);

  try {
    const loginId = localStorage.getItem('loginId');
    console.log('📍 거래 내역 조회 시작 - loginId:', loginId);

    // 두 개의 API 동시 호출
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
            description: item.type,
            reason: item.reason,
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
            description: item.type,
            itemName: item.itemName,
            source: 'transactions',
          });
        }
      });
    }

    // 날짜순 정렬
    tempHistory.sort((a, b) => b.date - a.date);

    allHistory = tempHistory;
    console.log('📍 전체 거래 내역:', allHistory.length, '건');

    applyFilters();
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-message">데이터를 불러올 수 없습니다</div>
      </div>
    `;
  } finally {
    isLoading = false;
  }
}

// 심플한 리스트 표시
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
    // 빈 상태에서도 헤더 업데이트
    updateSummaryHeader();
    return;
  }

  // HTML 생성
  let html = '';

  filteredHistory.forEach((item, index) => {
    const dateTime = formatDateTime(item.date);
    const description = formatDescription(item);

    // 금액 표시 및 클래스 결정
    let amountClass, amountText;

    // 저축 관련 거래 체크
    const isSaveTransaction =
      item.type === 'save' ||
      item.description === 'deposit' ||
      item.description === 'withdraw' ||
      item.description === 'interest';

    if (isSaveTransaction) {
      if (item.description === 'deposit') {
        amountClass = 'negative';
        amountText = `-${Math.abs(item.amount).toLocaleString()}P`;
      } else if (item.description === 'withdraw') {
        amountClass = 'positive';
        amountText = `${Math.abs(item.amount).toLocaleString()}P`;
      } else if (item.description === 'interest') {
        amountClass = 'neutral';
        amountText = `+${Math.abs(item.amount).toLocaleString()}P`;
      } else {
        amountClass = item.amount > 0 ? 'positive' : 'negative';
        amountText = `${item.amount > 0 ? '' : '-'}${Math.abs(
          item.amount
        ).toLocaleString()}P`;
      }
    } else {
      amountClass = item.amount > 0 ? 'positive' : 'negative';
      amountText = `${item.amount > 0 ? '' : '-'}${Math.abs(
        item.amount
      ).toLocaleString()}P`;
    }

    html += `
      <div class="history-item-simple">
        <div class="item-datetime">${dateTime}</div>
        <div class="item-description">${description}</div>
        <div class="item-amount ${amountClass}">${amountText}</div>
      </div>
    `;

    // 5개마다 굵은 구분선 추가 (마지막 제외)
    if ((index + 1) % 5 === 0 && index < filteredHistory.length - 1) {
      html += '<div class="list-thick-divider"></div>';
    }
  });

  container.innerHTML = html;
}

// 요약 헤더 업데이트
function updateSummaryHeader() {
  const header = document.getElementById('summaryHeader');
  if (!header) return;

  // 현재 선택된 기간에 따른 날짜 범위 계산
  const now = new Date();
  let startDate, endDate;

  switch (currentPeriod) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case '3month':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'all':
      if (filteredHistory.length > 0) {
        const dates = filteredHistory.map((item) => item.date);
        startDate = new Date(Math.min(...dates));
        endDate = new Date(Math.max(...dates));
      } else if (allHistory.length > 0) {
        // filteredHistory가 비어있어도 allHistory에서 날짜 범위 가져오기
        const dates = allHistory.map((item) => item.date);
        startDate = new Date(Math.min(...dates));
        endDate = new Date(Math.max(...dates));
      } else {
        // 데이터가 전혀 없는 경우 기본값
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        endDate = now;
      }
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
  }

  // 총 금액 계산 (절대값)
  const totalAmount = filteredHistory.reduce((sum, item) => {
    return sum + Math.abs(item.amount);
  }, 0);

  header.innerHTML = `
    <div class="summary-period">기간: ${formatDate(startDate)} - ${formatDate(
    endDate
  )}</div>
    <div class="summary-divider">|</div>
    <div class="summary-total">총 ${
      filteredHistory.length
    }건 (${totalAmount.toLocaleString()}P)</div>
  `;
}

// 필터 적용
// history.js - applyFilters 함수 수정

// 필터 적용 함수 (수정 버전)
function applyFilters() {
  let filtered = [...allHistory];

  // 타입 필터
  if (currentFilter !== 'all') {
    filtered = filtered.filter((item) => {
      switch (currentFilter) {
        case 'earn':
          return (
            item.type === 'earn' &&
            item.description !== 'deposit' &&
            item.description !== 'withdraw' &&
            item.description !== 'interest'
          );
        case 'spend':
          return (
            item.type === 'spend' &&
            item.description !== 'deposit' &&
            item.description !== 'withdraw'
          );
        case 'save':
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

  // 기간 필터 - 수정됨!
  const now = new Date();
  now.setHours(23, 59, 59, 999); // 오늘 끝까지 포함

  if (currentPeriod !== 'all') {
    let cutoffDate;

    switch (currentPeriod) {
      case 'today':
        // 오늘 자정부터 현재까지
        cutoffDate = new Date();
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 6); // 7일 전 (오늘 포함)
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 29); // 30일 전 (오늘 포함)
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case '3month':
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 89); // 90일 전 (오늘 포함)
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      default:
        cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 29); // 기본값: 30일
        cutoffDate.setHours(0, 0, 0, 0);
    }

    filtered = filtered.filter((item) => {
      return item.date >= cutoffDate;
    });
  }

  filteredHistory = filtered;
  console.log(`📍 필터링 결과: ${currentFilter} - ${filteredHistory.length}건`);

  displayHistory();
  updateSummaryHeader();
}

// updateSummaryHeader 함수도 수정
function updateSummaryHeader() {
  const header = document.getElementById('summaryHeader');
  if (!header) return;

  // 현재 선택된 기간에 따른 날짜 범위 계산
  const now = new Date();
  let startDate, endDate;

  switch (currentPeriod) {
    case 'today':
      // 오늘 날짜만
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = now;
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case '3month':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'all':
      if (filteredHistory.length > 0) {
        const dates = filteredHistory.map((item) => item.date);
        startDate = new Date(Math.min(...dates));
        endDate = new Date(Math.max(...dates));
      } else if (allHistory.length > 0) {
        const dates = allHistory.map((item) => item.date);
        startDate = new Date(Math.min(...dates));
        endDate = new Date(Math.max(...dates));
      } else {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        endDate = now;
      }
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
  }

  // 총 금액 계산 (절대값)
  const totalAmount = filteredHistory.reduce((sum, item) => {
    return sum + Math.abs(item.amount);
  }, 0);

  // 기간 표시 포맷 개선
  let periodText;
  if (currentPeriod === 'today') {
    periodText = `오늘 (${formatDate(startDate)})`;
  } else {
    periodText = `기간: ${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  header.innerHTML = `
    <div class="summary-period">${periodText}</div>
    <div class="summary-divider">|</div>
    <div class="summary-total">총 ${
      filteredHistory.length
    }건 (${totalAmount.toLocaleString()}P)</div>
  `;
}

// 스켈레톤 리스트 생성
function generateSkeletonList(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="history-item-simple skeleton">
        <div class="skeleton-line" style="width: 80px; height: 14px; background: #e5e7eb; border-radius: 4px;"></div>
        <div class="skeleton-line" style="width: 150px; height: 14px; background: #e5e7eb; border-radius: 4px; margin: 0 12px;"></div>
        <div class="skeleton-line" style="width: 70px; height: 14px; background: #e5e7eb; border-radius: 4px;"></div>
      </div>
    `;
  }
  return html;
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

// 초기화 시 요약 헤더 기본값 설정
function initializeSummaryHeader() {
  const header = document.getElementById('summaryHeader');
  if (!header) return;

  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 기본 1개월

  header.innerHTML = `
    <div class="summary-period">기간: ${formatDate(startDate)} - ${formatDate(
    now
  )}</div>
    <div class="summary-divider">|</div>
    <div class="summary-total">총 0건 (0원)</div>
  `;
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
    // 요약 헤더 초기화
    initializeSummaryHeader();

    await loadStudentData();
    await loadHistory();
    setupEventListeners();

    // ⭐ 동적 높이 조정 추가 (여기!)
    setTimeout(() => {
      adjustContainerPadding();
    }, 100);

    // ⭐ 윈도우 리사이즈 시에도 재조정 (여기!)
    window.addEventListener('resize', adjustContainerPadding);
  } catch (error) {
    console.error('초기화 오류:', error);
  }
});
