// interest-management.js - 이자 지급 관리 페이지

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('=== 이자 지급 관리 페이지 초기화 ===');

  // 사용자 정보 표시
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');

  document.getElementById('teacherName').textContent = userName || '선생님';
  document.getElementById('userRole').textContent =
    userRole === 'principal' ? '원장' : '선생님';

  // API 로드 대기
  await waitForAPI();

  // 초기 데이터 로드
  await checkPaymentStatus();
  await loadPreview();
  await loadPaymentHistory(); // 지급 이력 추가
});

// API 로드 대기 함수
async function waitForAPI() {
  let attempts = 0;
  while ((!window.api || !window.supabase) && attempts < 10) {
    console.log('API 로드 대기 중...');
    await new Promise((resolve) => setTimeout(resolve, 500));
    attempts++;
  }

  if (!window.api || !window.supabase) {
    console.error('API 로드 실패');
    alert('페이지를 새로고침해주세요.');
    return false;
  }

  console.log('API 로드 완료');
  return true;
}

// 지급 상태 확인
async function checkPaymentStatus() {
  try {
    // API 객체가 준비될 때까지 대기
    if (typeof api === 'undefined' || !api.getThisMonday) {
      console.error('API가 아직 로드되지 않음');
      setTimeout(checkPaymentStatus, 500);
      return;
    }

    const thisMonday = api.getThisMonday();

    // 이번 주 지급 여부 확인
    const { data } = await supabase
      .from('interest_payments')
      .select('payment_id')
      .eq('payment_date', thisMonday)
      .limit(1);

    const statusElement = document.getElementById('paymentStatus');
    const processBtn = document.getElementById('processBtn');

    if (data && data.length > 0) {
      statusElement.innerHTML =
        '<span class="status-completed">✅ 지급 완료</span>';
      processBtn.disabled = true;
      processBtn.textContent = '이번 주 지급 완료됨';
    } else {
      statusElement.innerHTML =
        '<span class="status-pending">⏳ 대기 중</span>';
      processBtn.disabled = false;
    }
  } catch (error) {
    console.error('상태 확인 실패:', error);
    const statusElement = document.getElementById('paymentStatus');
    if (statusElement) {
      statusElement.innerHTML =
        '<span class="status-error">⚠️ 확인 실패</span>';
    }
  }
}

// 미리보기
async function previewInterest() {
  try {
    const result = await api.previewInterest();

    if (result.success) {
      displayPreview(result.data, result.summary);
    } else {
      alert('미리보기 실패: ' + result.error);
    }
  } catch (error) {
    console.error('미리보기 오류:', error);
    alert('미리보기 중 오류가 발생했습니다.');
  }
}

// loadPreview 함수 개선
async function loadPreview() {
  try {
    console.log('미리보기 데이터 로드 시작');

    // API 확인
    if (!window.api || !window.api.previewInterest) {
      console.error('API가 준비되지 않았습니다');
      setTimeout(loadPreview, 1000);
      return;
    }

    const result = await api.previewInterest();
    console.log('미리보기 결과:', result);

    if (result.success) {
      // 요약 정보 표시
      const targetCount = document.getElementById('targetCount');
      const estimatedTotal = document.getElementById('estimatedTotal');
      const averageInterest = document.getElementById('averageInterest');

      if (targetCount)
        targetCount.textContent = result.summary.totalAccounts || 0;
      if (estimatedTotal)
        estimatedTotal.textContent = (
          result.summary.totalAmount || 0
        ).toLocaleString();
      if (averageInterest)
        averageInterest.textContent = (
          result.summary.averageAmount || 0
        ).toLocaleString();

      // 데이터가 있으면 테이블도 업데이트
      if (result.data && result.data.length > 0) {
        displayPreview(result.data, result.summary);
      }
    } else {
      console.error('미리보기 실패:', result.error);
      // 기본값 표시
      document.getElementById('targetCount').textContent = '0';
      document.getElementById('estimatedTotal').textContent = '0';
      document.getElementById('averageInterest').textContent = '0';
    }
  } catch (error) {
    console.error('미리보기 로드 오류:', error);
    // 에러 시 기본값
    document.getElementById('targetCount').textContent = '-';
    document.getElementById('estimatedTotal').textContent = '-';
    document.getElementById('averageInterest').textContent = '-';
  }
}

// 미리보기 표시
function displayPreview(data, summary) {
  const section = document.getElementById('previewSection');
  const tbody = document.getElementById('previewTableBody');

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 20px;">
          저축 잔액이 있는 학생이 없습니다.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = data
      .map(
        (item) => `
          <tr>
            <td><strong>${item.studentName}</strong></td>
            <td>${getLevelBadge(item.level)}</td>
            <td>${item.balance.toLocaleString()}P</td>
            <td>${item.rate}%</td>
            <td>${item.daysHeld}일</td>
            <td><strong>${(
              item.amount ||
              item.estimatedInterest ||
              0
            ).toLocaleString()}P</strong></td>
          </tr>
        `
      )
      .join('');
  }

  // 섹션 표시
  section.style.display = 'block';
}

// 지급 이력 로드 (새로 추가)
async function loadPaymentHistory() {
  try {
    // API가 준비되었는지 확인
    if (!window.api || !window.api.getInterestPaymentHistory) {
      console.log('지급 이력 API 없음 - 수동 조회');
      await loadPaymentHistoryManual();
      return;
    }

    const result = await api.getInterestPaymentHistory(4);

    if (result.success) {
      displayPaymentHistory(result.data);
    }
  } catch (error) {
    console.error('지급 이력 로드 실패:', error);
    await loadPaymentHistoryManual();
  }
}

// 지급 이력 수동 조회 (API 없을 때 대체)
async function loadPaymentHistoryManual() {
  try {
    const history = [];
    const today = new Date();

    // 최근 4주의 월요일 날짜 계산
    for (let i = 0; i < 4; i++) {
      const monday = new Date(today);
      const daysSinceMonday =
        (today.getDay() === 0 ? 6 : today.getDay() - 1) + i * 7;
      monday.setDate(today.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);
      const mondayStr = monday.toISOString().split('T')[0];

      // 해당 주 지급 내역 조회
      const { data: payments } = await supabase
        .from('interest_payments')
        .select('*')
        .eq('payment_date', mondayStr);

      const totalAmount =
        payments?.reduce((sum, p) => sum + (p.interest_amount || 0), 0) || 0;

      let weekLabel = '이번 주';
      if (i === 1) weekLabel = '지난 주';
      else if (i === 2) weekLabel = '2주 전';
      else if (i === 3) weekLabel = '3주 전';

      history.push({
        date: mondayStr,
        weekLabel: weekLabel,
        isPaid: payments && payments.length > 0,
        studentCount: payments?.length || 0,
        totalAmount: totalAmount,
      });
    }

    displayPaymentHistory(history);
  } catch (error) {
    console.error('수동 이력 조회 실패:', error);
  }
}

// 지급 이력 UI 표시
function displayPaymentHistory(history) {
  // 기존 요약 카드 영역 아래에 추가
  let historySection = document.getElementById('paymentHistorySection');

  if (!historySection) {
    historySection = document.createElement('div');
    historySection.id = 'paymentHistorySection';
    historySection.className = 'payment-history-section';
    historySection.style.cssText = `
      margin-top: 30px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    `;

    // 액션 버튼 영역 뒤에 삽입
    const actionSection = document.querySelector('.action-section');
    if (actionSection) {
      actionSection.insertAdjacentElement('afterend', historySection);
    } else {
      // 액션 섹션이 없으면 메인 컨텐츠 끝에 추가
      document.querySelector('.main-content').appendChild(historySection);
    }
  }

  const historyHTML = `
    <h3 class="section-title" style="margin-bottom: 20px; color: #1f2937; font-size: 18px;">
      📅 최근 4주 지급 내역
    </h3>
    <div class="history-grid" style="
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    ">
      ${history
        .map(
          (week) => `
        <div class="history-card" style="
          padding: 15px;
          border-radius: 8px;
          border: 2px solid ${week.isPaid ? '#10b981' : '#f59e0b'};
          background: ${week.isPaid ? '#f0fdf4' : '#fef3c7'};
          text-align: center;
        ">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">
            ${week.weekLabel}
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px;">
            ${new Date(week.date).toLocaleDateString('ko-KR')}
          </div>
          <div>
            ${
              week.isPaid
                ? `<span style="color: #10b981; font-weight: bold;">✅ 지급완료</span>
                 <div style="font-size: 11px; color: #6b7280; margin-top: 5px;">
                   ${
                     week.studentCount
                   }명 / ${week.totalAmount.toLocaleString()}P
                 </div>`
                : '<span style="color: #f59e0b; font-weight: bold;">⏳ 미지급</span>'
            }
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  historySection.innerHTML = historyHTML;
}

// 레벨 뱃지
function getLevelBadge(level) {
  const badges = {
    씨앗: '🌱 씨앗',
    새싹: '🌿 새싹',
    나무: '🌳 나무',
    큰나무: '🌲 큰나무',
    별: '⭐ 별',
    다이아몬드: '💎 다이아몬드',
  };
  return badges[level] || level;
}

// 실제 지급 실행
async function processInterest() {
  if (
    !confirm('정말 이자를 지급하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')
  ) {
    return;
  }

  const btn = document.getElementById('processBtn');
  const originalText = btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> 처리 중...';

  try {
    const result = await api.processWeeklyInterest();

    if (result.success) {
      displayResult(result.data, result.summary);
      await checkPaymentStatus(); // 상태 업데이트
      await loadPaymentHistory(); // 이력 업데이트
    } else {
      if (result.alreadyPaid) {
        alert('이번 주 이자는 이미 지급되었습니다.');
      } else {
        alert('이자 지급 실패: ' + result.error);
      }
    }
  } catch (error) {
    console.error('지급 처리 오류:', error);
    alert('처리 중 오류가 발생했습니다.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// 결과 표시
function displayResult(data, summary) {
  const section = document.getElementById('resultSection');
  const message = document.getElementById('successMessage');
  const tableDiv = document.getElementById('resultTable');

  // 성공 메시지
  message.textContent = `${
    data.length
  }명에게 총 ${summary.totalAmount.toLocaleString()}P의 이자가 지급되었습니다.`;

  // 결과 테이블
  tableDiv.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>학생명</th>
          <th>레벨</th>
          <th>저축잔액</th>
          <th>지급이자</th>
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (item) => `
            <tr>
              <td>${item.studentName}</td>
              <td>${getLevelBadge(item.level)}</td>
              <td>${item.balance.toLocaleString()}P</td>
              <td><strong>+${item.amount.toLocaleString()}P</strong></td>
            </tr>
          `
          )
          .join('')}
      </tbody>
    </table>
  `;

  // 섹션 표시
  section.style.display = 'block';
  document.getElementById('previewSection').style.display = 'none';
}

// 로그아웃
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}
