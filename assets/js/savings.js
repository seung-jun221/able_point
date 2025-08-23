// savings.js - 저축 시스템 핵심 로직 (실제 연동 버전)
// savings.js 맨 위에 추가
window.skipNavigationUpdate = true; // navigation 업데이트 비활성화
// 전역 변수
let studentData = null;
let cofixRate = 3.52; // 기본 COFIX 금리
let previousCofixRate = 3.5; // 이전 금리 (비교용)
let savingsHistory = [];
let currentDeposit = null;

// 전역 변수로 로딩 상태 관리
let isLoading = false;
let dataLoaded = false;

// 페이지 초기화 - 중복 방지
async function initializePage() {
  // 이미 로딩 중이면 리턴
  if (isLoading || dataLoaded) return;

  isLoading = true;
  console.log('저축 페이지 초기화 시작');

  try {
    // 1. 학생 데이터 한 번만 로드
    await loadStudentData();

    // 2. 저축 내역 한 번만 로드
    await loadSavingsHistory();

    dataLoaded = true;
  } finally {
    isLoading = false;
  }
}

// 상수
const SAVINGS_POLICY = {
  씨앗: { bonusRate: 0, maxLimit: 500, color: '#10b981' },
  새싹: { bonusRate: 0.5, maxLimit: 1000, color: '#22c55e' },
  나무: { bonusRate: 1.0, maxLimit: 2000, color: '#3b82f6' },
  큰나무: { bonusRate: 1.5, maxLimit: 5000, color: '#8b5cf6' },
  별: { bonusRate: 2.0, maxLimit: 8000, color: '#fbbf24' },
  다이아몬드: { bonusRate: 2.5, maxLimit: 10000, color: '#ec4899' },
};

const WITHDRAWAL_POLICY = {
  minimumPeriod: 7, // 최소 예치 7일
  earlyWithdrawal: {
    allowed: true,
    interestRate: 0,
    cooldown: 3,
  },
  normalWithdrawal: {
    interestRate: 100,
    bonusPoint: 10,
  },
  longTermBonus: {
    days14: 1.2, // 2주: 20% 추가
    days28: 1.5, // 4주: 50% 추가
  },
};

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  // 🔴 중복 실행 방지
  if (isLoading || dataLoaded) return;
  if (window.savingsPageInitialized) return;
  window.savingsPageInitialized = true;

  isLoading = true;
  console.log('저축 페이지 초기화 시작');

  // 로그인 체크
  const studentId = localStorage.getItem('loginId');
  if (!studentId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  showLoading(true);

  try {
    await loadStudentData();
    await loadCofixRate();
    await loadSavingsHistory(); // 먼저 로드
    await checkCurrentDeposit(); // 그 다음에 체크
    dataLoaded = true; // 🔴 추가
  } catch (error) {
    console.error('초기화 오류:', error);
  } finally {
    isLoading = false; // 🔴 추가
  }

  updateDisplay();
  calculateNextInterest();
  hideLoading();

  // 5분마다 COFIX 금리 업데이트
  setInterval(loadCofixRate, 5 * 60 * 1000);
});

// 로딩 표시
function showLoading(show) {
  if (show) {
    document.querySelectorAll('.rate-value').forEach((el) => {
      if (el && !el.querySelector('.loading-spinner')) {
        el.innerHTML = '<span class="loading-spinner"></span>';
      }
    });
  }
}

// 로딩 숨기기
function hideLoading() {
  document.querySelectorAll('.loading-spinner').forEach((spinner) => {
    if (spinner) spinner.remove();
  });
}

// 학생 데이터 로드 - 실제 연동
async function loadStudentData() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      studentData = result.data;
      console.log('학생 데이터 로드 성공:', studentData);

      // 현재 예치 정보 확인 (최근 입금 내역에서)
      await checkCurrentDeposit();
    } else {
      throw new Error('API 응답 실패: ' + result.error);
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
    alert('데이터를 불러올 수 없습니다.');
    window.location.href = 'index.html';
  }
}

// 현재 예치 정보 확인 (수정 버전)
async function checkCurrentDeposit() {
  if (studentData.savingsPoints > 0) {
    // 🔴 이미 로드된 savingsHistory 사용 (재호출 X)
    if (savingsHistory.length > 0) {
      const deposits = savingsHistory
        .filter((h) => h.type === 'deposit')
        .sort((a, b) => b.date - a.date);

      if (deposits.length > 0) {
        currentDeposit = {
          amount: studentData.savingsPoints,
          startDate: new Date(deposits[0].date),
          rate: cofixRate + (SAVINGS_POLICY[studentData.level]?.bonusRate || 0),
        };
      }
    }
  }
}

// COFIX 금리 로드 (시뮬레이션)
async function loadCofixRate() {
  try {
    // 실제로는 한국은행 API 또는 Google Sheets에서 가져올 수 있음
    previousCofixRate = cofixRate;

    // 시뮬레이션: 3.25~3.75% 사이에서 변동
    cofixRate = 3.5 + (Math.random() * 0.5 - 0.25);
    cofixRate = Math.round(cofixRate * 100) / 100;

    // 마지막 업데이트 시간
    const now = new Date();
    const updateElement = document.getElementById('lastUpdate');
    if (updateElement) {
      updateElement.textContent = `${now.getHours()}:${String(
        now.getMinutes()
      ).padStart(2, '0')} 업데이트`;
    }

    updateRateDisplay();
  } catch (error) {
    console.error('COFIX 금리 로드 오류:', error);
  }
}

// 금리 표시 업데이트
function updateRateDisplay() {
  if (!studentData) return;

  const policy = SAVINGS_POLICY[studentData.level] || SAVINGS_POLICY['씨앗'];
  const totalRate = cofixRate + policy.bonusRate;

  // COFIX 기준 금리
  const cofixElement = document.getElementById('cofixRate');
  if (cofixElement) {
    let changeIndicator = '';
    if (cofixRate > previousCofixRate) {
      changeIndicator = '<span class="rate-change rate-up">↑</span>';
    } else if (cofixRate < previousCofixRate) {
      changeIndicator = '<span class="rate-change rate-down">↓</span>';
    }
    cofixElement.innerHTML = `${cofixRate.toFixed(2)}%${changeIndicator}`;
  }

  // 등급 우대 금리
  const bonusElement = document.getElementById('bonusRate');
  if (bonusElement) {
    bonusElement.textContent = `+${policy.bonusRate}%`;
  }

  // 최종 금리
  const totalElement = document.getElementById('totalRate');
  if (totalElement) {
    totalElement.textContent = `${totalRate.toFixed(2)}%`;
  }

  // 모달에도 업데이트
  const modalRates = document.querySelectorAll('.modal-rate');
  modalRates.forEach((el) => {
    el.textContent = `연 ${totalRate.toFixed(2)}% (주 ${(
      totalRate / 52
    ).toFixed(3)}%)`;
  });
}

// 전체 화면 업데이트
function updateDisplay() {
  if (!studentData) return;

  const policy = SAVINGS_POLICY[studentData.level] || SAVINGS_POLICY['씨앗'];

  // 저축 잔액
  const savingsAmount = studentData.savingsPoints || 0;
  const balanceElement = document.getElementById('savingsBalance');
  if (balanceElement) {
    balanceElement.textContent = `${savingsAmount.toLocaleString()}P`;
  }

  // 저축 한도
  const limitElement = document.getElementById('savingsLimit');
  if (limitElement) {
    limitElement.textContent = `${policy.maxLimit.toLocaleString()}P`;
  }

  // 프로그레스 바
  const progress = (savingsAmount / policy.maxLimit) * 100;
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = `${Math.min(progress, 100)}%`;
  }

  // 예치 기간 표시
  if (currentDeposit && savingsAmount > 0) {
    const days = Math.floor(
      (new Date() - currentDeposit.startDate) / (1000 * 60 * 60 * 24)
    );
    const periodElement = document.getElementById('depositPeriod');
    if (periodElement) {
      periodElement.textContent = `예치 ${days}일차`;
      periodElement.style.display = 'inline-block';
      updateBonusBadges(days);
    }
  }

  // 버튼 활성화/비활성화
  updateButtonStates(savingsAmount, policy.maxLimit);

  // 모달 정보 업데이트
  const availableElement = document.getElementById('availablePoints');
  if (availableElement) {
    availableElement.textContent = `${studentData.currentPoints.toLocaleString()}P`;
  }

  const withdrawElement = document.getElementById('withdrawAvailable');
  if (withdrawElement) {
    withdrawElement.textContent = `${savingsAmount.toLocaleString()}P`;
  }
}

// 보너스 뱃지 업데이트
function updateBonusBadges(days) {
  const badgesContainer = document.getElementById('bonusBadges');
  if (!badgesContainer) return;

  badgesContainer.innerHTML = `
    <span class="bonus-badge ${days >= 7 ? 'bonus-active' : ''}">
      7일 달성 ${days >= 7 ? '✓' : ''}
    </span>
    <span class="bonus-badge ${days >= 14 ? 'bonus-active' : ''}">
      14일 달성 ${days >= 14 ? '+20%' : ''}
    </span>
    <span class="bonus-badge ${days >= 28 ? 'bonus-active' : ''}">
      28일 달성 ${days >= 28 ? '+50%' : ''}
    </span>
  `;
}

// 버튼 상태 업데이트
function updateButtonStates(savingsAmount, maxLimit) {
  const depositBtn = document.querySelector('.deposit-btn');
  const withdrawBtn = document.querySelector('.withdraw-btn');

  if (depositBtn) {
    if (savingsAmount >= maxLimit) {
      depositBtn.disabled = true;
      depositBtn.innerHTML = '💰 한도 도달';
    } else if (studentData.currentPoints <= 0) {
      depositBtn.disabled = true;
      depositBtn.innerHTML = '💰 포인트 부족';
    } else {
      depositBtn.disabled = false;
      depositBtn.innerHTML = '💰 입금하기';
    }
  }

  if (withdrawBtn) {
    if (savingsAmount <= 0) {
      withdrawBtn.disabled = true;
      withdrawBtn.innerHTML = '💸 잔액 없음';
    } else {
      withdrawBtn.disabled = false;
      withdrawBtn.innerHTML = '💸 출금하기';
    }
  }
}

// 다음 이자 계산
function calculateNextInterest() {
  if (!studentData || !studentData.savingsPoints) {
    const interestElement = document.getElementById('expectedInterest');
    if (interestElement) {
      interestElement.textContent = '+0P';
    }
    return;
  }

  const policy = SAVINGS_POLICY[studentData.level] || SAVINGS_POLICY['씨앗'];
  const totalRate = cofixRate + policy.bonusRate;
  const weeklyRate = totalRate / 52; // 연이율을 주이율로 변환

  let expectedInterest = Math.floor(
    studentData.savingsPoints * (weeklyRate / 100)
  );

  // 장기 보너스 적용
  if (currentDeposit && studentData.savingsPoints > 0) {
    const days = Math.floor(
      (new Date() - currentDeposit.startDate) / (1000 * 60 * 60 * 24)
    );
    if (days >= 28) {
      expectedInterest = Math.floor(
        expectedInterest * WITHDRAWAL_POLICY.longTermBonus.days28
      );
    } else if (days >= 14) {
      expectedInterest = Math.floor(
        expectedInterest * WITHDRAWAL_POLICY.longTermBonus.days14
      );
    }
  }

  const interestElement = document.getElementById('expectedInterest');
  if (interestElement) {
    interestElement.textContent = `+${expectedInterest}P`;
  }

  // 다음 월요일 계산
  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);

  const dateElement = document.getElementById('nextInterestDate');
  if (dateElement) {
    const options = { month: 'long', day: 'numeric', weekday: 'long' };
    dateElement.textContent = nextMonday.toLocaleDateString('ko-KR', options);
  }
}

// 거래 내역 로드 - 실제 연동
async function loadSavingsHistory() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getSavingsHistory(studentId);

    if (result.success) {
      savingsHistory = result.data.map((item) => ({
        type: item.type,
        amount: item.amount,
        date: new Date(item.date),
        itemName: item.itemName || getDefaultTitle(item.type),
      }));

      displayHistory();
      return savingsHistory;
    } else {
      savingsHistory = [];
      displayHistory();
      return [];
    }
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
    savingsHistory = [];
    displayHistory();
    return [];
  }
}

// 기본 제목
function getDefaultTitle(type) {
  const titles = {
    deposit: '저축 입금',
    withdraw: '저축 출금',
    interest: '이자 지급',
  };
  return titles[type] || type;
}

// 거래 내역 표시
// 거래 내역 표시 - 수정된 버전
function displayHistory() {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  if (savingsHistory.length === 0) {
    historyList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #94a3b8;">
        아직 거래 내역이 없습니다
      </div>
    `;
    return;
  }

  historyList.innerHTML = savingsHistory
    .map((item) => {
      // 아이콘 설정
      const icon =
        item.type === 'deposit' ? '💰' : item.type === 'withdraw' ? '💸' : '💎';

      // 아이콘 클래스
      const iconClass =
        item.type === 'deposit'
          ? 'icon-deposit'
          : item.type === 'withdraw'
          ? 'icon-withdraw'
          : 'icon-interest';

      // ⭐ 중요: 사용자 관점에서 수정
      // deposit(입금): 사용 가능 포인트가 줄어듦 → negative (빨간색)
      // withdraw(출금): 사용 가능 포인트가 늘어남 → positive (초록색)
      // interest(이자): 저축 계좌에 추가됨 → positive (초록색)
      const amountClass =
        item.type === 'deposit'
          ? 'amount-negative' // 입금은 빨간색
          : item.type === 'withdraw'
          ? 'amount-positive' // 출금은 초록색
          : 'amount-positive'; // 이자는 초록색

      // 금액 표시 부호
      const amountSign =
        item.type === 'deposit'
          ? '-' // 입금은 마이너스
          : item.type === 'withdraw'
          ? '+' // 출금은 플러스
          : '+'; // 이자는 플러스

      // 타입 텍스트
      const typeText =
        item.type === 'deposit'
          ? '저축 입금'
          : item.type === 'withdraw'
          ? '저축 출금'
          : '이자 지급';

      return `
      <div class="history-item">
        <div class="history-info">
          <div class="history-icon ${iconClass}">${icon}</div>
          <div class="history-details">
            <div class="history-type">${typeText}</div>
            <div class="history-date">${formatDate(item.date)}</div>
          </div>
        </div>
        <div>
          <div class="history-amount ${amountClass}">
            ${amountSign}${item.amount.toLocaleString()}P
          </div>
        </div>
      </div>
    `;
    })
    .join('');
}

// 날짜 포맷
function formatDate(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;

  return date.toLocaleDateString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
  });
}

// 입금 모달 열기
window.showDepositModal = function () {
  const modal = document.getElementById('depositModal');
  if (modal) {
    modal.classList.add('active');

    // 최대 입금 가능 금액 계산
    const policy = SAVINGS_POLICY[studentData.level] || SAVINGS_POLICY['씨앗'];
    const maxDeposit = Math.min(
      studentData.currentPoints,
      policy.maxLimit - studentData.savingsPoints
    );

    const maxElement = document.getElementById('maxDepositAmount');
    if (maxElement) {
      maxElement.textContent = `최대 ${maxDeposit.toLocaleString()}P`;
    }
  }
};

// 출금 모달 열기
window.showWithdrawModal = function () {
  const modal = document.getElementById('withdrawModal');
  if (modal) {
    modal.classList.add('active');

    // 조기 출금 경고 표시
    if (currentDeposit && studentData.savingsPoints > 0) {
      const days = Math.floor(
        (new Date() - currentDeposit.startDate) / (1000 * 60 * 60 * 24)
      );
      const warningElement = document.getElementById('earlyWithdrawWarning');
      if (days < 7 && warningElement) {
        warningElement.style.display = 'block';
        const daysElement = document.getElementById('earlyWithdrawDays');
        if (daysElement) {
          daysElement.textContent = 7 - days;
        }
      }
    }
  }
};

// 모달 닫기
window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');

    // 입력 초기화
    document.querySelectorAll('.modal-input').forEach((input) => {
      input.value = '';
    });
  }
};

// 금액 설정
window.setAmount = function (type, amount) {
  const inputId = type === 'deposit' ? 'depositAmount' : 'withdrawAmount';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = amount;
  }
};

// 최대 입금
window.setMaxDeposit = function () {
  const policy = SAVINGS_POLICY[studentData.level] || SAVINGS_POLICY['씨앗'];
  const maxAmount = Math.min(
    studentData.currentPoints,
    policy.maxLimit - studentData.savingsPoints
  );
  const input = document.getElementById('depositAmount');
  if (input) {
    input.value = maxAmount;
  }
};

// 전액 출금
window.setMaxWithdraw = function () {
  const input = document.getElementById('withdrawAmount');
  if (input) {
    input.value = studentData.savingsPoints;
  }
};

// 입금 확인 - 실제 API 연동
window.confirmDeposit = async function () {
  const amountInput = document.getElementById('depositAmount');
  if (!amountInput) return;

  const amount = parseInt(amountInput.value);

  if (!amount || amount <= 0) {
    showNotification('금액을 입력해주세요', 'warning');
    return;
  }

  const policy = SAVINGS_POLICY[studentData.level] || SAVINGS_POLICY['씨앗'];
  const maxDeposit = policy.maxLimit - studentData.savingsPoints;

  if (amount > maxDeposit) {
    showNotification(
      `최대 ${maxDeposit.toLocaleString()}P까지 입금 가능합니다`,
      'warning'
    );
    return;
  }

  if (amount > studentData.currentPoints) {
    showNotification('포인트가 부족합니다', 'error');
    return;
  }

  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.deposit(studentId, amount);

    if (result.success) {
      showNotification(`${amount.toLocaleString()}P 입금 완료!`, 'success');

      // 데이터 업데이트
      studentData.currentPoints -= amount;
      studentData.savingsPoints += amount;

      // 현재 예치 정보 저장
      currentDeposit = {
        amount: studentData.savingsPoints,
        startDate: new Date(),
        rate: cofixRate + policy.bonusRate,
      };

      // 화면 업데이트
      updateDisplay();
      calculateNextInterest();

      // 내역 다시 로드
      await loadSavingsHistory();

      closeModal('depositModal');
    } else {
      showNotification(
        result.error || '입금 처리 중 오류가 발생했습니다',
        'error'
      );
    }
  } catch (error) {
    console.error('입금 오류:', error);
    showNotification('입금 처리 중 오류가 발생했습니다', 'error');
  }
};

// 출금 확인 - 실제 API 연동
window.confirmWithdraw = async function () {
  const amountInput = document.getElementById('withdrawAmount');
  if (!amountInput) return;

  const amount = parseInt(amountInput.value);
  console.log(
    '출금 시도 - 금액:',
    amount,
    '학생ID:',
    localStorage.getItem('loginId')
  );

  if (!amount || amount <= 0) {
    showNotification('금액을 입력해주세요', 'warning');
    return;
  }

  if (amount > studentData.savingsPoints) {
    showNotification('저축 잔액이 부족합니다', 'error');
    return;
  }

  // 조기 출금 확인 (생략 가능)

  try {
    const studentId = localStorage.getItem('loginId');
    console.log('API 호출 - studentId:', studentId, 'amount:', amount);

    const result = await api.withdraw(studentId, amount);
    console.log('API 응답:', result);

    if (result.success) {
      showNotification(`${amount.toLocaleString()}P 출금 완료!`, 'success');

      // 데이터 업데이트
      studentData.currentPoints += amount;
      studentData.savingsPoints -= amount;

      // 전액 출금인 경우
      if (studentData.savingsPoints === 0) {
        currentDeposit = null;
      }

      // 화면 업데이트
      updateDisplay();
      calculateNextInterest();
      await loadSavingsHistory();

      closeModal('withdrawModal');
    } else {
      console.error('출금 실패:', result.error);
      showNotification(
        result.error || '출금 처리 중 오류가 발생했습니다',
        'error'
      );
    }
  } catch (error) {
    console.error('출금 오류:', error);
    showNotification('출금 처리 중 오류가 발생했습니다', 'error');
  }
};

// 알림 표시 - 안전한 버전
function showNotification(message, type = 'info') {
  // 간단한 커스텀 알림 만들기
  const notification = document.createElement('div');
  notification.className = 'custom-notification';
  notification.innerHTML = `
    <div class="notification-content ${type}">
      <span class="notification-icon">
        ${
          type === 'success'
            ? '✅'
            : type === 'error'
            ? '❌'
            : type === 'warning'
            ? '⚠️'
            : 'ℹ️'
        }
      </span>
      <span class="notification-message">${message}</span>
    </div>
  `;

  // body에 추가
  document.body.appendChild(notification);

  // 3초 후 제거
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach((modal) => {
      modal.classList.remove('active');
    });
  }
});

// 모달 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});
