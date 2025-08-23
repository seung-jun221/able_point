// savings.js - 저축 시스템 핵심 로직 (전역 변수 충돌 해결 버전)
// ====================================
// 네비게이션 중복 방지
// ====================================
window.skipNavigationUpdate = true;

// ====================================
// 전역 변수 (window 객체 활용)
// ====================================
// studentData를 window 객체로 관리하여 충돌 방지
window.studentData = window.studentData || null;

// 페이지 전용 변수들
let cofixRate = 3.52;
let previousCofixRate = 3.5;
let savingsHistory = [];
let currentDeposit = null;
let isLoading = false;
let dataLoaded = false;

// ====================================
// 상수 정의
// ====================================
const SAVINGS_POLICY = {
  씨앗: { bonusRate: 0, maxLimit: 500, color: '#10b981' },
  새싹: { bonusRate: 0.5, maxLimit: 1000, color: '#22c55e' },
  나무: { bonusRate: 1.0, maxLimit: 2000, color: '#3b82f6' },
  큰나무: { bonusRate: 1.5, maxLimit: 5000, color: '#8b5cf6' },
  별: { bonusRate: 2.0, maxLimit: 8000, color: '#fbbf24' },
  다이아몬드: { bonusRate: 2.5, maxLimit: 10000, color: '#ec4899' },
};

const WITHDRAWAL_POLICY = {
  minimumPeriod: 7,
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
    days14: 1.2,
    days28: 1.5,
  },
};

// ====================================
// 페이지 초기화 (통합된 단일 DOMContentLoaded)
// ====================================
document.addEventListener('DOMContentLoaded', async () => {
  // 중복 실행 방지
  if (window.savingsPageInitialized) return;
  window.savingsPageInitialized = true;

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
    // 데이터 로드 순서 중요
    await loadStudentData();
    await loadCofixRate();
    await loadSavingsHistory();
    await checkCurrentDeposit();

    // 헤더 포인트 수동 업데이트
    if (window.studentData) {
      const headerEl = document.getElementById('headerTotalPoints');
      if (headerEl) {
        headerEl.textContent =
          window.studentData.currentPoints.toLocaleString() + 'P';
      }
    }

    dataLoaded = true;
  } catch (error) {
    console.error('초기화 오류:', error);
  } finally {
    isLoading = false;
  }

  updateDisplay();
  calculateNextInterest();
  hideLoading();

  // 5분마다 COFIX 금리 업데이트
  setInterval(loadCofixRate, 5 * 60 * 1000);
});

// ====================================
// 로딩 관련 함수
// ====================================
function showLoading(show) {
  if (show) {
    document.querySelectorAll('.rate-value').forEach((el) => {
      if (el && !el.querySelector('.loading-spinner')) {
        el.innerHTML = '<span class="loading-spinner"></span>';
      }
    });
  }
}

function hideLoading() {
  document.querySelectorAll('.loading-spinner').forEach((spinner) => {
    if (spinner) spinner.remove();
  });
}

// ====================================
// 데이터 로드 함수들
// ====================================
async function loadStudentData() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      // window.studentData에 저장
      window.studentData = result.data;
      console.log('학생 데이터 로드 성공:', window.studentData);
    } else {
      throw new Error('API 응답 실패: ' + result.error);
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
    alert('데이터를 불러올 수 없습니다.');
    window.location.href = 'index.html';
  }
}

async function checkCurrentDeposit() {
  if (window.studentData && window.studentData.savingsPoints > 0) {
    if (savingsHistory.length > 0) {
      const deposits = savingsHistory
        .filter((h) => h.type === 'deposit')
        .sort((a, b) => b.date - a.date);

      if (deposits.length > 0) {
        currentDeposit = {
          amount: window.studentData.savingsPoints,
          startDate: new Date(deposits[0].date),
          rate:
            cofixRate +
            (SAVINGS_POLICY[window.studentData.level]?.bonusRate || 0),
        };
      }
    }
  }
}

async function loadCofixRate() {
  try {
    previousCofixRate = cofixRate;
    cofixRate = 3.5 + (Math.random() * 0.5 - 0.25);
    cofixRate = Math.round(cofixRate * 100) / 100;

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

// ====================================
// UI 업데이트 함수들
// ====================================
function updateRateDisplay() {
  if (!window.studentData) return;

  const policy =
    SAVINGS_POLICY[window.studentData.level] || SAVINGS_POLICY['씨앗'];
  const totalRate = cofixRate + policy.bonusRate;

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

  const bonusElement = document.getElementById('bonusRate');
  if (bonusElement) {
    bonusElement.textContent = `+${policy.bonusRate}%`;
  }

  const totalElement = document.getElementById('totalRate');
  if (totalElement) {
    totalElement.textContent = `${totalRate.toFixed(2)}%`;
  }

  const modalRates = document.querySelectorAll('.modal-rate');
  modalRates.forEach((el) => {
    el.textContent = `연 ${totalRate.toFixed(2)}% (주 ${(
      totalRate / 52
    ).toFixed(3)}%)`;
  });
}

function updateDisplay() {
  if (!window.studentData) return;

  const policy =
    SAVINGS_POLICY[window.studentData.level] || SAVINGS_POLICY['씨앗'];
  const savingsAmount = window.studentData.savingsPoints || 0;

  const balanceElement = document.getElementById('savingsBalance');
  if (balanceElement) {
    balanceElement.textContent = `${savingsAmount.toLocaleString()}P`;
  }

  const limitElement = document.getElementById('savingsLimit');
  if (limitElement) {
    limitElement.textContent = `${policy.maxLimit.toLocaleString()}P`;
  }

  const progress = (savingsAmount / policy.maxLimit) * 100;
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = `${Math.min(progress, 100)}%`;
  }

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

  updateButtonStates(savingsAmount, policy.maxLimit);

  const availableElement = document.getElementById('availablePoints');
  if (availableElement) {
    availableElement.textContent = `${window.studentData.currentPoints.toLocaleString()}P`;
  }

  const withdrawElement = document.getElementById('withdrawAvailable');
  if (withdrawElement) {
    withdrawElement.textContent = `${savingsAmount.toLocaleString()}P`;
  }
}

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

function updateButtonStates(savingsAmount, maxLimit) {
  const depositBtn = document.querySelector('.deposit-btn');
  const withdrawBtn = document.querySelector('.withdraw-btn');

  if (depositBtn) {
    if (savingsAmount >= maxLimit) {
      depositBtn.disabled = true;
      depositBtn.innerHTML = '💰 한도 도달';
    } else if (window.studentData.currentPoints <= 0) {
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

function calculateNextInterest() {
  if (!window.studentData || !window.studentData.savingsPoints) {
    const interestElement = document.getElementById('expectedInterest');
    if (interestElement) {
      interestElement.textContent = '+0P';
    }
    return;
  }

  const policy =
    SAVINGS_POLICY[window.studentData.level] || SAVINGS_POLICY['씨앗'];
  const totalRate = cofixRate + policy.bonusRate;
  const weeklyRate = totalRate / 52;

  let expectedInterest = Math.floor(
    window.studentData.savingsPoints * (weeklyRate / 100)
  );

  if (currentDeposit && window.studentData.savingsPoints > 0) {
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
      const icon =
        item.type === 'deposit' ? '💰' : item.type === 'withdraw' ? '💸' : '💎';

      const iconClass =
        item.type === 'deposit'
          ? 'icon-deposit'
          : item.type === 'withdraw'
          ? 'icon-withdraw'
          : 'icon-interest';

      const amountClass =
        item.type === 'deposit'
          ? 'amount-negative'
          : item.type === 'withdraw'
          ? 'amount-positive'
          : 'amount-positive';

      const amountSign =
        item.type === 'deposit' ? '-' : item.type === 'withdraw' ? '+' : '+';

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

// ====================================
// 모달 관련 함수들
// ====================================
window.showDepositModal = function () {
  const modal = document.getElementById('depositModal');
  if (modal) {
    modal.classList.add('active');

    const policy =
      SAVINGS_POLICY[window.studentData.level] || SAVINGS_POLICY['씨앗'];
    const maxDeposit = Math.min(
      window.studentData.currentPoints,
      policy.maxLimit - window.studentData.savingsPoints
    );

    const maxElement = document.getElementById('maxDepositAmount');
    if (maxElement) {
      maxElement.textContent = `최대 ${maxDeposit.toLocaleString()}P`;
    }
  }
};

window.showWithdrawModal = function () {
  const modal = document.getElementById('withdrawModal');
  if (modal) {
    modal.classList.add('active');

    if (currentDeposit && window.studentData.savingsPoints > 0) {
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

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.querySelectorAll('.modal-input').forEach((input) => {
      input.value = '';
    });
  }
};

window.setAmount = function (type, amount) {
  const inputId = type === 'deposit' ? 'depositAmount' : 'withdrawAmount';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = amount;
  }
};

window.setMaxDeposit = function () {
  const policy =
    SAVINGS_POLICY[window.studentData.level] || SAVINGS_POLICY['씨앗'];
  const maxAmount = Math.min(
    window.studentData.currentPoints,
    policy.maxLimit - window.studentData.savingsPoints
  );
  const input = document.getElementById('depositAmount');
  if (input) {
    input.value = maxAmount;
  }
};

window.setMaxWithdraw = function () {
  const input = document.getElementById('withdrawAmount');
  if (input) {
    input.value = window.studentData.savingsPoints;
  }
};

// ====================================
// API 연동 함수들
// ====================================
window.confirmDeposit = async function () {
  const amountInput = document.getElementById('depositAmount');
  if (!amountInput) return;

  const amount = parseInt(amountInput.value);

  if (!amount || amount <= 0) {
    showNotification('금액을 입력해주세요', 'warning');
    return;
  }

  const policy =
    SAVINGS_POLICY[window.studentData.level] || SAVINGS_POLICY['씨앗'];
  const maxDeposit = policy.maxLimit - window.studentData.savingsPoints;

  if (amount > maxDeposit) {
    showNotification(
      `최대 ${maxDeposit.toLocaleString()}P까지 입금 가능합니다`,
      'warning'
    );
    return;
  }

  if (amount > window.studentData.currentPoints) {
    showNotification('포인트가 부족합니다', 'error');
    return;
  }

  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.deposit(studentId, amount);

    if (result.success) {
      showNotification(`${amount.toLocaleString()}P 입금 완료!`, 'success');

      window.studentData.currentPoints -= amount;
      window.studentData.savingsPoints += amount;

      // 헤더 포인트 업데이트
      const headerEl = document.getElementById('headerTotalPoints');
      if (headerEl) {
        headerEl.textContent =
          window.studentData.currentPoints.toLocaleString() + 'P';
      }

      currentDeposit = {
        amount: window.studentData.savingsPoints,
        startDate: new Date(),
        rate: cofixRate + policy.bonusRate,
      };

      updateDisplay();
      calculateNextInterest();
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

  if (amount > window.studentData.savingsPoints) {
    showNotification('저축 잔액이 부족합니다', 'error');
    return;
  }

  try {
    const studentId = localStorage.getItem('loginId');
    console.log('API 호출 - studentId:', studentId, 'amount:', amount);

    const result = await api.withdraw(studentId, amount);
    console.log('API 응답:', result);

    if (result.success) {
      showNotification(`${amount.toLocaleString()}P 출금 완료!`, 'success');

      window.studentData.currentPoints += amount;
      window.studentData.savingsPoints -= amount;

      // 헤더 포인트 업데이트
      const headerEl = document.getElementById('headerTotalPoints');
      if (headerEl) {
        headerEl.textContent =
          window.studentData.currentPoints.toLocaleString() + 'P';
      }

      if (window.studentData.savingsPoints === 0) {
        currentDeposit = null;
      }

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

// ====================================
// 유틸리티 함수들
// ====================================
function getDefaultTitle(type) {
  const titles = {
    deposit: '저축 입금',
    withdraw: '저축 출금',
    interest: '이자 지급',
  };
  return titles[type] || type;
}

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

function showNotification(message, type = 'info') {
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

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

// ====================================
// 이벤트 리스너
// ====================================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach((modal) => {
      modal.classList.remove('active');
    });
  }
});

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});
