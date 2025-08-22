// ✅ Supabase ISO 형식 날짜 파싱 함수
function parseDate(dateString) {
  if (!dateString) return null;

  try {
    // Supabase는 ISO 8601 형식 반환
    // 예: "2024-11-15T09:30:00+00:00" 또는 "2024-11-15T09:30:00.123Z"
    const date = new Date(dateString);

    // 유효성 검사
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

// history.js - 거래 내역 페이지 로직 (디버깅 강화 버전)

// 전역 변수
let allHistory = [];
let filteredHistory = [];
let currentFilter = 'all';
let currentPeriod = 'month';
let studentData = null;

// 초기화 - 수정
document.addEventListener('DOMContentLoaded', async () => {
  console.log('거래 내역 페이지 초기화');

  // ✅ loginId 사용
  const loginId = localStorage.getItem('loginId');
  if (!loginId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  const container = document.getElementById('historyListContainer');
  if (container) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <div style="margin-top: 10px; color: #94a3b8;">데이터를 불러오는 중...</div>
      </div>
    `;
  }

  try {
    await loadStudentData();
    await loadHistory();
    setupEventListeners();
    updateDisplay();
  } catch (error) {
    console.error('초기화 오류:', error);
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <div class="empty-title">초기화 실패</div>
          <div class="empty-desc">페이지를 새로고침해주세요</div>
        </div>
      `;
    }
  }
});

// 학생 데이터 로드 - 수정
async function loadStudentData() {
  try {
    // ✅ loginId 사용
    const loginId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(loginId);

    if (result.success) {
      studentData = result.data;
      console.log('학생 데이터 로드:', studentData);
    } else {
      console.error('학생 데이터 로드 실패:', result.error);
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
  }
}

// loadHistory 함수 수정
async function loadHistory(loadMore = false) {
  if (isLoading) return;
  isLoading = true;

  try {
    // ✅ loginId 사용
    const loginId = localStorage.getItem('loginId');
    const container = document.getElementById('historyListContainer');

    if (!loadMore) {
      container.innerHTML = generateSkeletonList(10);
    }

    const cacheKey = `history_${loginId}_${currentPage}`;
    let historyData = cache.get(cacheKey);

    if (!historyData) {
      console.log('📍 API 호출 - 페이지:', currentPage);

      const [pointsResult, transResult] = await Promise.all([
        api.getPointHistory(loginId),
        api.getTransactionHistory(loginId),
      ]);

      const tempHistory = [];

      // Points 데이터 처리 - 수정된 날짜 파싱
      if (pointsResult.success && pointsResult.data) {
        pointsResult.data.forEach((item) => {
          const parsedDate = parseDate(item.date); // ✅ 새 함수 사용
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

      // Transactions 데이터 처리 - 수정된 날짜 파싱
      if (transResult.success && transResult.data) {
        transResult.data.forEach((item) => {
          const parsedDate = parseDate(item.createdAt); // ✅ 새 함수 사용
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

      // 정렬
      tempHistory.sort((a, b) => b.date - a.date);

      // 페이지네이션 적용
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      historyData = tempHistory.slice(start, end);

      cache.set(cacheKey, historyData);

      if (!loadMore) {
        allHistory = tempHistory;
      }
    }

    if (loadMore) {
      appendHistoryItems(historyData);
    } else {
      filteredHistory = historyData;
      displayHistory();
    }

    if (historyData.length === ITEMS_PER_PAGE) {
      showLoadMoreButton();
    }
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
  } finally {
    isLoading = false;
  }
}
// 더보기 버튼 표시
function showLoadMoreButton() {
  const container = document.getElementById('historyListContainer');
  const existingBtn = document.getElementById('loadMoreBtn');

  if (!existingBtn) {
    const btnHtml = `
      <div id="loadMoreBtn" class="load-more-container">
        <button class="btn btn-secondary" onclick="loadMore()">
          더 많은 내역 보기
        </button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', btnHtml);
  }
}

// 더보기 기능
function loadMore() {
  currentPage++;
  loadHistory(true);
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

  // URL 파라미터 체크
  const urlParams = new URLSearchParams(window.location.search);
  const filter = urlParams.get('filter');
  if (filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.remove('active');
      if (btn.dataset.filter === filter) {
        btn.classList.add('active');
      }
    });
  }
}

// 3️⃣ applyFilters 함수 수정 (디버깅 추가)
function applyFilters() {
  console.log('📍 applyFilters 호출됨');
  console.log('현재 필터:', currentFilter);
  console.log('현재 기간:', currentPeriod);

  let filtered = [...allHistory];
  console.log('필터 전 개수:', filtered.length);

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
    console.log('타입 필터 후 개수:', filtered.length);
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
  console.log('기간 제한:', daysLimit + '일');

  filtered = filtered.filter((item) => {
    // 날짜가 없으면 제외
    if (!item.date || isNaN(item.date.getTime())) {
      console.log('Invalid date item:', item);
      return false;
    }

    const daysDiff = Math.floor((now - item.date) / (1000 * 60 * 60 * 24));
    const isIncluded = daysDiff <= daysLimit;

    if (!isIncluded && daysDiff < 100) {
      // 100일 이내인데 필터링된 경우만 로그
      console.log(
        `필터링됨: ${item.title}, ${daysDiff}일 전 (제한: ${daysLimit}일)`
      );
    }

    return isIncluded;
  });

  console.log('기간 필터 후 개수:', filtered.length);

  filteredHistory = filtered;
  console.log('📍 최종 필터 결과:', filteredHistory.length + '건');

  displayHistory();
  updateStatistics();
}

// 거래 내역 표시 - 디버깅 강화 버전
function displayHistory() {
  console.log('displayHistory 호출됨');
  console.log('filteredHistory 개수:', filteredHistory.length);

  const container = document.getElementById('historyListContainer');

  if (!container) {
    console.error('❌ historyListContainer를 찾을 수 없습니다');
    // 대체 컨테이너 찾기
    const alternativeContainer = document.querySelector('.history-container');
    if (alternativeContainer) {
      console.log('대체 컨테이너 찾음');
      const newDiv = document.createElement('div');
      newDiv.id = 'historyListContainer';
      alternativeContainer.appendChild(newDiv);
    }
    return;
  }

  console.log('✅ Container 찾음:', container);

  if (filteredHistory.length === 0) {
    console.log('거래 내역이 없음');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">거래 내역이 없습니다</div>
        <div class="empty-desc">선택한 기간에 거래가 없어요</div>
      </div>
    `;
    return;
  }

  console.log('거래 내역 렌더링 시작');

  // 날짜별 그룹화
  const grouped = {};
  filteredHistory.forEach((item) => {
    const dateKey = formatDateKey(item.date);
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(item);
  });

  console.log('그룹화된 데이터:', grouped);

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
            ${
              item.balance !== undefined
                ? `<div class="item-balance">잔액 ${item.balance.toLocaleString()}P</div>`
                : ''
            }
          </div>
        </div>
      `;
    });
  });

  html += '</div>';

  console.log('생성된 HTML 길이:', html.length);
  container.innerHTML = html;
  console.log('✅ HTML 삽입 완료');
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

// 아이콘 클래스 가져오기
function getIconClass(type) {
  const classes = {
    earn: 'icon-earn',
    spend: 'icon-spend',
    save: 'icon-save',
  };
  return classes[type] || 'icon-earn';
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
    } else if (
      (item.type === 'spend' && item.amount < 0) ||
      item.type === 'spend'
    ) {
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

  if (earnElement) {
    earnElement.textContent = `+${totalEarn.toLocaleString()}P`;
  }

  if (spendElement) {
    spendElement.textContent = `${totalSpend.toLocaleString()}P`;
  }

  if (saveElement) {
    saveElement.textContent = `${Math.abs(totalSave).toLocaleString()}P`;
  }
}

// 전체 화면 업데이트
function updateDisplay() {
  // 상단 정보 업데이트
  const nameElement = document.getElementById('userName');
  if (nameElement && studentData) {
    nameElement.textContent = studentData.name;
  }

  const pointsElement = document.getElementById('currentPoints');
  if (pointsElement && studentData) {
    pointsElement.textContent = `${studentData.currentPoints.toLocaleString()}P`;
  }
}
