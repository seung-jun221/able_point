// savings.js - 저축 시스템 핵심 로직

// 전역 변수
let studentData = null;
let cofixRate = 3.52; // 기본 COFIX 금리
let previousCofixRate = 3.5; // 이전 금리 (비교용)
let savingsHistory = [];
let currentDeposit = null;

// 상수
const SAVINGS_POLICY = {
  씨앗: { bonusRate: 0, maxLimit: 500, color: '#10b981' },
  새싹: { bonusRate: 0.5, maxLimit: 1000, color: '#22c55e' },
  나무: { bonusRate: 1.0, maxLimit: 2000, color: '#3b82f6' },
  큰나무: { bonusRate: 1.5, maxLimit: 5000, color: '#8b5cf6' },
  다이아: { bonusRate: 2.0, maxLimit: 10000, color: '#fbbf24' },
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
  console.log('저축 페이지 초기화 시작');

  showLoading(true);

  try {
    await loadStudentData();
    await loadCofixRate();
    await loadSavingsHistory();
  } catch (error) {
    console.error('초기화 오류:', error);
  }

  updateDisplay();
  calculateNextInterest();
  hideLoading();

  // 5분마다 COFIX 금리 업데이트
  setInterval(loadCofixRate, 5 * 60 * 1000);
});

// 로그인 체크
function checkLogin() {
  const studentId = localStorage.getItem('loginId');
  if (!studentId) {
    console.log('로그인 정보 없음 - 테스트 모드로 진행');
    return false;
  }
  return true;
}

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

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const studentId = localStorage.getItem('loginId') || 'TEST001';
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      studentData = result.data;
      console.log('학생 데이터 로드 성공:', studentData);
    } else {
      throw new Error('API 응답 실패');
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
    // 기본 데이터 설정
    studentData = {
      studentId: 'TEST001',
      name: '테스트학생',
      level: '큰나무',
      currentPoints: 52081,
      savingsPoints: 0,
      totalPoints: 52081,
    };
  }
}

// COFIX 금리 로드
async function loadCofixRate() {
  try {
    // 시뮬레이션 (실제로는 한국은행 API 사용)
    previousCofixRate = cofixRate;
    cofixRate = 3.5 + (Math.random() * 0.5 - 0.25); // 3.25~3.75%
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

  // 등급 가산 금리
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
  if (currentDeposit) {
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
  if (currentDeposit) {
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

// 거래 내역 로드
async function loadSavingsHistory() {
  try {
    const studentId = localStorage.getItem('loginId') || 'TEST001';
    const result = await api.getSavingsHistory(studentId);

    if (result.success) {
      savingsHistory = result.data;
    } else {
      savingsHistory = [];
    }

    displayHistory();
  } catch (error) {
    console.error('거래 내역 로드 오류:', error);
    savingsHistory = [];
    displayHistory();
  }
}

// 거래 내역 표시
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
        item.type === 'withdraw' ? 'amount-negative' : 'amount-positive';
      const amountSign = item.type === 'withdraw' ? '-' : '+';
      const typeText =
        item.type === 'deposit'
          ? '입금'
          : item.type === 'withdraw'
          ? '출금'
          : '이자';

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
          <div style="font-size: 11px; color: #94a3b8; text-align: right;">
            잔액 ${item.balance.toLocaleString()}P
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
  const targetDate = new Date(date);
  const diff = Math.floor((now - targetDate) / (1000 * 60 * 60 * 24));

  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;

  return targetDate.toLocaleDateString('ko-KR', {
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
    if (currentDeposit) {
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

// 입금 확인
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
    const studentId = localStorage.getItem('loginId') || 'TEST001';
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

      // 내역 추가
      savingsHistory.unshift({
        type: 'deposit',
        amount: amount,
        date: new Date(),
        balance: studentData.savingsPoints,
      });
      displayHistory();

      closeModal('depositModal');
    }
  } catch (error) {
    console.error('입금 오류:', error);
    showNotification('입금 처리 중 오류가 발생했습니다', 'error');
  }
};

// 출금 확인
window.confirmWithdraw = async function () {
  const amountInput = document.getElementById('withdrawAmount');
  if (!amountInput) return;

  const amount = parseInt(amountInput.value);

  if (!amount || amount <= 0) {
    showNotification('금액을 입력해주세요', 'warning');
    return;
  }

  if (amount > studentData.savingsPoints) {
    showNotification('저축 잔액이 부족합니다', 'error');
    return;
  }

  // 조기 출금 확인
  let isEarlyWithdraw = false;
  if (currentDeposit) {
    const days = Math.floor(
      (new Date() - currentDeposit.startDate) / (1000 * 60 * 60 * 24)
    );
    if (days < 7) {
      isEarlyWithdraw = true;
      if (
        !confirm('7일 미만 출금 시 이자를 받을 수 없습니다.\n계속하시겠습니까?')
      ) {
        return;
      }
    }
  }

  try {
    const studentId = localStorage.getItem('loginId') || 'TEST001';
    const result = await api.withdraw(studentId, amount);

    if (result.success) {
      let message = `${amount.toLocaleString()}P 출금 완료!`;

      // 이자 계산 (7일 이상인 경우)
      if (!isEarlyWithdraw && currentDeposit) {
        const days = Math.floor(
          (new Date() - currentDeposit.startDate) / (1000 * 60 * 60 * 24)
        );
        const weeklyRate = currentDeposit.rate / 52;
        let interest = Math.floor(amount * (weeklyRate / 100) * (days / 7));

        // 장기 보너스
        if (days >= 28) {
          interest = Math.floor(interest * 1.5);
          message += ` (이자 ${interest}P 포함)`;
        } else if (days >= 14) {
          interest = Math.floor(interest * 1.2);
          message += ` (이자 ${interest}P 포함)`;
        }

        studentData.currentPoints += interest;
      }

      showNotification(message, 'success');

      // 데이터 업데이트
      studentData.currentPoints += amount;
      studentData.savingsPoints -= amount;

      // 전액 출금인 경우 예치 정보 초기화
      if (studentData.savingsPoints === 0) {
        currentDeposit = null;
      }

      // 화면 업데이트
      updateDisplay();
      calculateNextInterest();

      // 내역 추가
      savingsHistory.unshift({
        type: 'withdraw',
        amount: amount,
        date: new Date(),
        balance: studentData.savingsPoints,
      });
      displayHistory();

      closeModal('withdrawModal');
    }
  } catch (error) {
    console.error('출금 오류:', error);
    showNotification('출금 처리 중 오류가 발생했습니다', 'error');
  }
};

// 알림 표시
function showNotification(message, type = 'info') {
  // toastr가 있으면 사용
  if (typeof toastr !== 'undefined') {
    toastr[type](message);
  } else {
    // 없으면 alert
    alert(message);
  }
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
