// history.js - 거래 내역 페이지 로직

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
    // 테스트 모드
    initTestData();
  } else {
    await loadStudentData();
  }

  await loadHistory();
  setupEventListeners();
  updateDisplay();
});

// 테스트 데이터 초기화
function initTestData() {
  studentData = {
    studentId: 'TEST001',
    name: '테스트학생',
    currentPoints: 52081,
    level: '큰나무',
  };

  // 테스트 거래 내역
  allHistory = generateTestHistory();
}

// 테스트 거래 내역 생성
function generateTestHistory() {
  const types = [
    { type: 'earn', title: '출석 보상', amount: 10, icon: '✅' },
    { type: 'earn', title: '숙제 완료', amount: 30, icon: '📚' },
    { type: 'earn', title: '시험 만점', amount: 100, icon: '💯' },
    { type: 'spend', title: '연필 구매', amount: -10, icon: '✏️' },
    { type: 'spend', title: '과자 구매', amount: -50, icon: '🍪' },
    { type: 'save', title: '저축 입금', amount: -500, icon: '💰' },
    { type: 'save', title: '저축 출금', amount: 500, icon: '💸' },
    { type: 'interest', title: '저축 이자', amount: 10, icon: '💎' },
    { type: 'gift', title: '친구 선물', amount: -100, icon: '🎁' },
    { type: 'gift', title: '선물 받음', amount: 100, icon: '🎁' },
  ];

  const history = [];
  let balance = 52081;

  // 최근 30일간의 거래 생성
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const transaction = types[Math.floor(Math.random() * types.length)];

    history.push({
      id: `TRX${String(i + 1).padStart(5, '0')}`,
      date: date,
      type: transaction.type,
      title: transaction.title,
      amount: transaction.amount,
      balance: balance,
      icon: transaction.icon,
      description: getDescription(transaction.type),
    });

    balance -= transaction.amount;
  }

  // 날짜순 정렬 (최신순)
  return history.sort((a, b) => b.date - a.date);
}

// 설명 생성
function getDescription(type) {
  const descriptions = {
    earn: '포인트 획득',
    spend: '포인트 사용',
    save: '저축 계좌',
    interest: '이자 지급',
    gift: '포인트 선물',
  };
  return descriptions[type] || '';
}

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      studentData = result.data;
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
  }
}

// 거래 내역 로드
async function loadHistory() {
  try {
    const studentId = localStorage.getItem('loginId') || 'TEST001';

    // 실제 API 호출 시
    // const result = await api.getPointHistory(studentId);
    // if (result.success) {
    //   allHistory = result.data;
    // }

    // 현재는 테스트 데이터 사용
    if (allHistory.length === 0) {
      allHistory = generateTestHistory();
    }

    applyFilters();
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
  }
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

// 필터 적용
function applyFilters() {
  let filtered = [...allHistory];

  // 타입 필터
  if (currentFilter !== 'all') {
    filtered = filtered.filter((item) => {
      switch (currentFilter) {
        case 'earn':
          return item.amount > 0 && item.type !== 'save';
        case 'spend':
          return item.amount < 0 && item.type === 'spend';
        case 'save':
          return item.type === 'save' || item.type === 'interest';
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
        item.amount > 0 ? `+${item.amount}P` : `${item.amount}P`;

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
    interest: 'icon-interest',
    gift: 'icon-gift',
  };
  return classes[type] || 'icon-earn';
}

// 통계 업데이트
function updateStatistics() {
  let totalEarn = 0;
  let totalSpend = 0;
  let totalSave = 0;

  filteredHistory.forEach((item) => {
    if (item.amount > 0 && item.type !== 'save') {
      totalEarn += item.amount;
    } else if (item.amount < 0 && item.type === 'spend') {
      totalSpend += Math.abs(item.amount);
    } else if (item.type === 'save' || item.type === 'interest') {
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

// 내보내기 함수 (다른 페이지에서 사용)
window.filterHistory = function (type) {
  currentFilter = type;

  // 해당 탭 활성화
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.remove('active');
    if (btn.dataset.filter === type) {
      btn.classList.add('active');
    }
  });

  applyFilters();
};
