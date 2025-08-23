// student-main.js - 학생 메인 페이지 전용 함수 (저축 분류 수정 버전)

// 탭 전환 함수
function showTab(tabName) {
  // 모든 탭 버튼과 콘텐츠 숨기기
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.remove('active');
  });

  // 선택된 탭 활성화
  const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
  const tabContent = document.getElementById(`${tabName}-content`);

  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');

  // 탭별 데이터 로드
  loadTabData(tabName);
}

// 탭별 데이터 로드
function loadTabData(tabName) {
  switch (tabName) {
    case 'overview':
      // 전체 요약 데이터는 이미 로드됨
      break;
    case 'earn':
      loadEarnSummary();
      break;
    case 'spend':
      loadSpendSummary();
      break;
    case 'save':
      loadSaveSummary();
      break;
  }
}

// 획득 내역 요약 로드 - 🔥 수정됨
async function loadEarnSummary() {
  try {
    const loginId = localStorage.getItem('loginId');
    if (!loginId) return;

    console.log('획득 내역 로드 시작...');

    // API 호출하여 포인트 내역과 거래 내역 가져오기
    const [pointsResult, transResult] = await Promise.all([
      api.getPointHistory(loginId),
      api.getTransactionHistory(loginId),
    ]);

    // 획득 내역만 필터링 (양수 금액, 저축 제외)
    const earnHistory = [];

    // Points 데이터에서 획득 내역 추출
    if (pointsResult.success && pointsResult.data) {
      pointsResult.data.forEach((item) => {
        // 🔥 저축 관련 제외
        if (
          item.amount > 0 &&
          item.type !== 'deposit' &&
          item.type !== 'withdraw' &&
          item.type !== 'interest'
        ) {
          earnHistory.push({
            title: item.reason || getDefaultTitle(item.type),
            amount: item.amount,
            date: formatDate(item.date),
            icon: getIconForType(item.type),
            type: 'earn',
          });
        }
      });
    }

    // Transactions 데이터에서 획득 내역 추출
    if (transResult.success && transResult.data) {
      transResult.data.forEach((item) => {
        // 🔥 저축 관련 완전 제외
        if (
          item.amount > 0 &&
          item.type !== 'deposit' &&
          item.type !== 'withdraw' &&
          item.type !== 'interest'
        ) {
          earnHistory.push({
            title: item.itemName || getDefaultTitle(item.type),
            amount: item.amount,
            date: formatDate(item.createdAt),
            icon: getIconForType(item.type),
            type: 'earn',
          });
        }
      });
    }

    // 날짜순 정렬 (최신순)
    earnHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 최근 3개만 가져오기
    const recentEarn = earnHistory.slice(0, 3);

    // 이번 달 총 획득 계산
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyTotal = earnHistory
      .filter((item) => {
        const itemDate = new Date(item.date);
        return (
          itemDate.getMonth() === currentMonth &&
          itemDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, item) => sum + item.amount, 0);

    // DOM 업데이트
    updateEarnTab(recentEarn, monthlyTotal);
  } catch (error) {
    console.error('획득 내역 로드 실패:', error);
  }
}

// 사용 내역 요약 로드 - 🔥 수정됨
async function loadSpendSummary() {
  try {
    const loginId = localStorage.getItem('loginId');
    if (!loginId) return;

    console.log('사용 내역 로드 시작...');

    // API 호출
    const [pointsResult, transResult] = await Promise.all([
      api.getPointHistory(loginId),
      api.getTransactionHistory(loginId),
    ]);

    // 사용 내역만 필터링 (음수 금액 또는 purchase/transfer 타입, 저축 제외)
    const spendHistory = [];

    // Points 데이터에서 사용 내역 추출
    if (pointsResult.success && pointsResult.data) {
      pointsResult.data.forEach((item) => {
        // 🔥 저축 관련 제외
        if (
          item.amount < 0 &&
          item.type !== 'deposit' &&
          item.type !== 'withdraw'
        ) {
          spendHistory.push({
            title: item.reason || getDefaultTitle(item.type),
            amount: Math.abs(item.amount),
            date: formatDate(item.date),
            icon: getIconForType(item.type),
            type: 'spend',
          });
        }
      });
    }

    // Transactions 데이터에서 사용 내역 추출
    if (transResult.success && transResult.data) {
      transResult.data.forEach((item) => {
        // 🔥 deposit 조건 제거, 저축 관련 제외
        if (
          (item.type === 'purchase' || item.type === 'transfer') &&
          item.type !== 'deposit' &&
          item.type !== 'withdraw' &&
          item.type !== 'interest'
        ) {
          spendHistory.push({
            title: item.itemName || getDefaultTitle(item.type),
            amount: Math.abs(item.amount),
            date: formatDate(item.createdAt),
            icon: getIconForType(item.type),
            type: 'spend',
          });
        }
      });
    }

    // 날짜순 정렬 (최신순)
    spendHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 최근 3개만 가져오기
    const recentSpend = spendHistory.slice(0, 3);

    // 이번 달 총 사용 계산
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyTotal = spendHistory
      .filter((item) => {
        const itemDate = new Date(item.date);
        return (
          itemDate.getMonth() === currentMonth &&
          itemDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, item) => sum + item.amount, 0);

    // DOM 업데이트
    updateSpendTab(recentSpend, monthlyTotal);
  } catch (error) {
    console.error('사용 내역 로드 실패:', error);
  }
}

// 저축 내역 요약 로드
async function loadSaveSummary() {
  try {
    const loginId = localStorage.getItem('loginId');
    if (!loginId) return;

    console.log('저축 내역 로드 시작...');

    // 거래 내역 가져오기
    const transResult = await api.getTransactionHistory(loginId);

    // 저축 관련 내역만 필터링
    const savingsHistory = [];

    if (transResult.success && transResult.data) {
      transResult.data.forEach((item) => {
        if (
          item.type === 'deposit' ||
          item.type === 'withdraw' ||
          item.type === 'interest'
        ) {
          savingsHistory.push({
            title: getDefaultTitle(item.type),
            amount: item.amount,
            date: formatDate(item.createdAt),
            icon: getIconForSavings(item.type),
            type: item.type,
          });
        }
      });
    }

    // 날짜순 정렬 (최신순)
    savingsHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 최근 3개만 가져오기
    const recentSavings = savingsHistory.slice(0, 3);

    // 현재 저축 잔액 (studentData에서 가져오기)
    const currentSavings = studentData?.savingsPoints || 0;

    // DOM 업데이트
    updateSaveTab(recentSavings, currentSavings);
  } catch (error) {
    console.error('저축 내역 로드 실패:', error);
  }
}

// ========== DOM 업데이트 함수들 ==========

// 획득 탭 업데이트
function updateEarnTab(recentItems, monthlyTotal) {
  const tabContent = document.getElementById('earn-content');
  if (!tabContent) return;

  let html = `
    <div class="summary-card">
      <div class="summary-header">
        <span class="summary-title">이번 달 획득 포인트</span>
      </div>
      <div class="summary-value" style="color: #22c55e">+${monthlyTotal.toLocaleString()}P</div>
      
      <div class="mini-history">`;

  if (recentItems.length > 0) {
    recentItems.forEach((item) => {
      html += `
        <div class="mini-history-item">
          <div class="mini-item-left">
            <div class="mini-icon" style="background: #dcfce7">${
              item.icon
            }</div>
            <div class="mini-item-info">
              <div class="mini-item-title">${item.title}</div>
              <div class="mini-item-date">${getRelativeTime(item.date)}</div>
            </div>
          </div>
          <div class="mini-item-amount amount-plus">+${item.amount}P</div>
        </div>`;
    });
  } else {
    html += `
      <div style="text-align: center; padding: 20px; color: #94a3b8;">
        아직 획득 내역이 없습니다.
      </div>`;
  }

  html += `
      </div>
      <button class="view-more-btn" onclick="location.href='history.html?filter=earn'">
        전체 획득 내역 보기 →
      </button>
    </div>
  </div>`;

  tabContent.innerHTML = html;
}

// 사용 탭 업데이트
function updateSpendTab(recentItems, monthlyTotal) {
  const tabContent = document.getElementById('spend-content');
  if (!tabContent) return;

  let html = `
    <div class="summary-card">
      <div class="summary-header">
        <span class="summary-title">이번 달 사용 포인트</span>
      </div>
      <div class="summary-value" style="color: #ef4444">-${monthlyTotal.toLocaleString()}P</div>
      
      <div class="mini-history">`;

  if (recentItems.length > 0) {
    recentItems.forEach((item) => {
      html += `
        <div class="mini-history-item">
          <div class="mini-item-left">
            <div class="mini-icon" style="background: #fee2e2">${
              item.icon
            }</div>
            <div class="mini-item-info">
              <div class="mini-item-title">${item.title}</div>
              <div class="mini-item-date">${getRelativeTime(item.date)}</div>
            </div>
          </div>
          <div class="mini-item-amount amount-minus">-${item.amount}P</div>
        </div>`;
    });
  } else {
    html += `
      <div style="text-align: center; padding: 20px; color: #94a3b8;">
        아직 사용 내역이 없습니다.
      </div>`;
  }

  html += `
      </div>
      <button class="view-more-btn" onclick="location.href='history.html?filter=spend'">
        전체 사용 내역 보기 →
      </button>
    </div>
  </div>`;

  tabContent.innerHTML = html;
}

// 저축 탭 업데이트 - 수정된 버전
function updateSaveTab(recentItems, currentSavings) {
  const tabContent = document.getElementById('save-content');
  if (!tabContent) return;

  let html = `
    <div class="summary-card">
      <div class="summary-header">
        <span class="summary-title">저축 계좌 현황</span>
      </div>
      <div class="summary-value" style="color: #6366f1">${currentSavings.toLocaleString()}P</div>
      
      <div class="mini-history">`;

  if (recentItems.length > 0) {
    recentItems.forEach((item) => {
      // 배경색 설정
      const bgColor =
        item.type === 'deposit'
          ? '#fee2e2' // 입금은 빨간 계열 (사용 가능 포인트 감소)
          : item.type === 'withdraw'
          ? '#dcfce7' // 출금은 초록 계열 (사용 가능 포인트 증가)
          : '#fef3c7'; // 이자는 노란 계열

      // ⭐ 중요: 사용자 관점에서 표시
      // deposit: 사용 가능 포인트에서 빠져나감 → minus (빨간색) → -500P
      // withdraw: 사용 가능 포인트로 들어옴 → plus (초록색) → +500P
      // interest: 저축 계좌에 추가 (직접적인 영향 없음) → 노란색 → +40P
      let amountClass, amountText;

      if (item.type === 'deposit') {
        // 입금: 사용 가능 포인트 감소
        amountClass = 'amount-minus';
        amountText = `-${Math.abs(item.amount)}P`;
      } else if (item.type === 'withdraw') {
        // 출금: 사용 가능 포인트 증가
        amountClass = 'amount-plus';
        amountText = `+${Math.abs(item.amount)}P`;
      } else {
        // 이자: 저축 계좌에 추가 (중립적 표시)
        amountClass = 'amount-plus';
        amountText = `+${Math.abs(item.amount)}P`;
      }

      html += `
        <div class="mini-history-item">
          <div class="mini-item-left">
            <div class="mini-icon" style="background: ${bgColor}">${
        item.icon
      }</div>
            <div class="mini-item-info">
              <div class="mini-item-title">${item.title}</div>
              <div class="mini-item-date">${getRelativeTime(item.date)}</div>
            </div>
          </div>
          <div class="mini-item-amount ${amountClass}">${amountText}</div>
        </div>`;
    });
  } else {
    html += `
      <div style="text-align: center; padding: 20px; color: #94a3b8;">
        아직 저축 내역이 없습니다.
      </div>`;
  }

  html += `
      </div>
      <button class="view-more-btn" onclick="location.href='savings.html'">
        저축 계좌 관리 →
      </button>
    </div>
  </div>`;

  tabContent.innerHTML = html;
}

// ========== 유틸리티 함수들 ==========

// 기본 제목 가져오기
function getDefaultTitle(type) {
  const titles = {
    attendance: '출석 보상',
    homework: '숙제 완료',
    quiz: '퀴즈 보상',
    behavior: '행동 보상',
    purchase: '상품 구매',
    transfer: '포인트 선물',
    deposit: '저축 입금',
    withdraw: '저축 출금',
    interest: '이자 지급',
    earn: '포인트 획득',
    spend: '포인트 사용',
  };
  return titles[type] || '포인트 변동';
}

// 아이콘 가져오기
function getIconForType(type) {
  const icons = {
    attendance: '✅',
    homework: '📚',
    quiz: '💯',
    behavior: '⭐',
    purchase: '🛍️',
    transfer: '🎁',
    deposit: '💰',
    withdraw: '💸',
    interest: '💎',
    earn: '➕',
    spend: '➖',
  };
  return icons[type] || '💳';
}

// 저축 아이콘 가져오기
function getIconForSavings(type) {
  const icons = {
    deposit: '💰',
    withdraw: '💸',
    interest: '💎',
  };
  return icons[type] || '🏦';
}

// 날짜 포맷팅
function formatDate(dateString) {
  if (!dateString) return '';
  return dateString;
}

// 상대 시간 계산
function getRelativeTime(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 1) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// ========== 기존 함수들 (유지) ==========

// 거래 내역 페이지로 이동 (필터 적용)
function goToHistory(filter) {
  if (filter === 'all') {
    location.href = 'history.html';
  } else {
    location.href = `history.html?filter=${filter}`;
  }
}

// 전체 내역 보기
function showHistory() {
  location.href = 'history.html';
}

// 전체 활동 보기
function showAllHistory() {
  location.href = 'history.html';
}

// 친구 선물 모달
function showGift() {
  const modal = document.getElementById('transferModal');
  if (modal) {
    modal.classList.add('active');
    // 보유 포인트 업데이트
    const currentPoints = studentData?.currentPoints || 0;
    const availableElement = document.getElementById('availablePoints');
    if (availableElement) {
      availableElement.textContent = currentPoints.toLocaleString();
    }

    // 친구 목록 로드
    loadFriendsList();
  }
}

// 친구 목록 로드
async function loadFriendsList() {
  try {
    const loginId = localStorage.getItem('loginId');
    const result = await api.getStudentList();

    if (result.success) {
      const select = document.getElementById('recipientSelect');
      select.innerHTML = '<option value="">친구를 선택하세요</option>';

      result.data.forEach((student) => {
        if (student.loginId !== loginId) {
          const option = document.createElement('option');
          option.value = student.loginId;
          option.textContent = `${student.name} (${student.avatar})`;
          select.appendChild(option);
        }
      });
    }
  } catch (error) {
    console.error('친구 목록 로드 실패:', error);
  }
}

// 모달 닫기
function closeModal() {
  const modal = document.getElementById('transferModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// 포인트 선물 전송
async function sendTransfer() {
  const recipientId = document.getElementById('recipientSelect').value;
  const amount = parseInt(document.getElementById('transferAmount').value);
  const message = document.getElementById('transferMessage').value;

  if (!recipientId || !amount || amount <= 0) {
    alert('받는 친구와 포인트를 확인해주세요.');
    return;
  }

  const loginId = localStorage.getItem('loginId');
  const result = await api.transferPoints(
    loginId,
    recipientId,
    amount,
    message
  );

  if (result.success) {
    alert('포인트를 성공적으로 선물했습니다!');
    closeModal();
    // 데이터 새로고침
    loadStudentData();
  } else {
    alert(result.error || '선물하기에 실패했습니다.');
  }
}
