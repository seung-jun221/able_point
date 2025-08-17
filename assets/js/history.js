// history.js - 거래 내역 페이지 로직 (실제 연동 버전)

// 전역 변수
let allHistory = [];
let filteredHistory = [];
let currentFilter = 'all';
let currentPeriod = 'month';
let studentData = null;

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('거래 내역 페이지 초기화');

  // 로그인 체크
  const studentId = localStorage.getItem('loginId');
  if (!studentId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 학생 데이터 로드
  await loadStudentData();

  // 거래 내역 로드
  await loadHistory();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 화면 업데이트
  updateDisplay();
});

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(studentId);

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

// 거래 내역 로드 - 실제 API 연동
async function loadHistory() {
  try {
    const studentId = localStorage.getItem('loginId');

    // Points 시트에서 포인트 내역 가져오기
    const pointsResult = await api.getPointHistory(studentId);

    // Transactions 시트에서 거래 내역 가져오기
    const transResult = await api.getTransactionHistory(studentId);

    allHistory = [];

    // Points 데이터 처리
    if (pointsResult.success && pointsResult.data) {
      pointsResult.data.forEach((item) => {
        allHistory.push({
          id: item.id,
          date: new Date(item.date),
          type: getTransactionType(item.type, item.amount),
          title: item.reason || getDefaultTitle(item.type),
          amount: parseInt(item.amount),
          icon: getIconForType(item.type),
          description: item.type,
          source: 'points',
        });
      });
    }

    // Transactions 데이터 처리
    if (transResult.success && transResult.data) {
      transResult.data.forEach((item) => {
        allHistory.push({
          id: item.transactionId,
          date: new Date(item.createdAt),
          type: getTransactionType(item.type, item.amount),
          title: item.itemName || getDefaultTitle(item.type),
          amount: parseInt(item.amount),
          icon: getIconForType(item.type),
          description: item.type,
          source: 'transactions',
        });
      });
    }

    // 날짜순 정렬 (최신순)
    allHistory.sort((a, b) => b.date - a.date);

    // 잔액 계산 (역순으로)
    let balance = studentData ? studentData.currentPoints : 0;
    for (let i = 0; i < allHistory.length; i++) {
      allHistory[i].balance = balance;
      balance -= allHistory[i].amount;
    }

    console.log('거래 내역 로드 완료:', allHistory.length + '건');
    applyFilters();
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
    allHistory = [];
  }
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

// 필터 적용
function applyFilters() {
  let filtered = [...allHistory];

  // 타입 필터
  if (currentFilter !== 'all') {
    filtered = filtered.filter((item) => {
      switch (currentFilter) {
        case 'earn':
          return item.amount > 0 && item.type === 'earn';
        case 'spend':
          return item.amount < 0 && item.type === 'spend';
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
    const daysDiff = Math.floor((now - item.date) / (1000 * 60 * 60 * 24));
    return daysDiff <= daysLimit;
  });

  filteredHistory = filtered;
  displayHistory();
  updateStatistics();
}

// 거래 내역 표시
function displayHistory() {
  const container = document.getElementById('historyListContainer');

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
  let html = '';
  Object.keys(grouped).forEach((dateKey) => {
    html += `<div class="date-group">${dateKey}</div>`;

    grouped[dateKey].forEach((item) => {
      const iconClass = getIconClass(item.type);
      const amountClass =
        item.amount > 0 ? 'amount-positive' : 'amount-negative';
      const amountText =
        item.amount > 0
          ? `+${Math.abs(item.amount)}P`
          : `-${Math.abs(item.amount)}P`;

      html += `
        <div class="history-item">
          <div class="item-left">
            <div class="item-icon ${iconClass}">
              ${item.icon}
            </div>
            <div class="item-info">
              <div class="item-title">${item.title}</div>
              <div class="item-desc">${item.description}</div>
            </div>
          </div>
          <div class="item-right">
            <div class="item-amount ${amountClass}">${amountText}</div>
            <div class="item-balance">잔액 ${item.balance.toLocaleString()}P</div>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = `<div class="history-list">${html}</div>`;
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
    if (item.type === 'earn' && item.amount > 0) {
      totalEarn += Math.abs(item.amount);
    } else if (item.type === 'spend' && item.amount < 0) {
      totalSpend += Math.abs(item.amount);
    } else if (item.type === 'save') {
      totalSave += Math.abs(item.amount);
    }
  });

  // 통계 표시
  document.getElementById(
    'statEarn'
  ).textContent = `+${totalEarn.toLocaleString()}P`;
  document.getElementById(
    'statSpend'
  ).textContent = `${totalSpend.toLocaleString()}P`;
  document.getElementById(
    'statSave'
  ).textContent = `${totalSave.toLocaleString()}P`;
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
