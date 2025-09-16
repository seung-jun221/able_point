// interest-management.js - 이자 지급 관리 페이지

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('이자 지급 관리 페이지 초기화');

  // 사용자 정보 표시
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');

  document.getElementById('teacherName').textContent = userName || '선생님';
  document.getElementById('userRole').textContent =
    userRole === 'principal' ? '원장' : '선생님';

  // 초기 상태 확인
  await checkPaymentStatus();
  await loadPreview();
});

// 지급 상태 확인
async function checkPaymentStatus() {
  try {
    const thisMonday = api.getThisMonday();
    const nextMonday = api.getNextMonday();

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

// 미리보기 자동 로드
async function loadPreview() {
  try {
    const result = await api.previewInterest();

    if (result.success && result.summary) {
      // 요약 정보 표시
      document.getElementById('targetCount').textContent =
        result.summary.totalAccounts;
      document.getElementById('estimatedTotal').textContent =
        result.summary.totalAmount.toLocaleString();
      document.getElementById('averageInterest').textContent =
        result.summary.averageAmount.toLocaleString();
    }
  } catch (error) {
    console.error('초기 미리보기 실패:', error);
  }
}

// 미리보기 표시
function displayPreview(data, summary) {
  const section = document.getElementById('previewSection');
  const tbody = document.getElementById('previewTableBody');

  // 테이블 내용 생성
  tbody.innerHTML = data
    .map(
      (item) => `
        <tr>
            <td><strong>${item.studentName}</strong></td>
            <td>${getLevelBadge(item.level)}</td>
            <td>${item.balance.toLocaleString()}P</td>
            <td>${item.rate}%</td>
            <td>${item.daysHeld}일</td>
            <td><strong>${item.estimatedInterest.toLocaleString()}P</strong></td>
        </tr>
    `
    )
    .join('');

  // 섹션 표시
  section.style.display = 'block';
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
