// teacher.js - 포인트 정책이 반영된 선생님 페이지

// ==================== 포인트 정책 설정 ====================
const POINT_POLICY = {
  elementary: {
    earn: {
      mathPerfect: 50, // 연산 만점
      tamdalSite: 1, // 탐달 사고력 사이트 (실제 획득 포인트 그대로)
      homework: 100, // 과제 완료
      levelTest: 200, // 등급유지테스트 통과
      writingExcellent: 300, // 서술형 우수자
      tantanComplete: 300, // 탄탄북 완료
      onlineComplete: 500, // 온라인 문제풀이 완료
      makeupWork: 200, // 결석분 가정학습 완료
      friendRecommend: 10000, // 신규생 친구 추천
      returnRecommend: 30000, // 퇴원생 재등원 추천
      teacherSpecial: [10, 20, 30, 50], // 선생님 재량 특별포인트
    },
    penalty: {
      noBook: -200, // 책 미지참
      noHomework: -500, // 과제 미제출
      badHomework: -300, // 과제 불성실 (50% 이상 오답시)
      mathTimeout: -50, // 연산 시간 초과 (5분 초과시)
      behaviorWarning: null, // 태도 문제 (경고) - 재량
    },
  },
  middle: {
    earn: {
      homework: 200, // 과제 완료
      levelTest: 500, // 등급유지테스트 통과
      writingExcellent: 300, // 서술형 우수자
      onlineComplete: 1000, // 온라인 문제풀이 완료
      makeupWork: 200, // 결석분 가정학습 완료
      friendRecommend: 10000, // 신규생 친구 추천
      returnRecommend: 30000, // 퇴원생 재등원 추천
      teacherSpecial: [10, 20, 30, 50], // 선생님 재량 특별포인트
    },
    penalty: {
      noBook: -300, // 책 미지참
      noHomework: -500, // 과제 미제출
      badHomework: -300, // 과제 불성실 (50% 이상 오답시)
      behaviorWarning: null, // 태도 문제 (경고) - 재량
    },
  },
};

// ==================== 상품 목록 ====================
const SHOP_ITEMS = [
  // 츄파춥스
  { name: '츄파춥스', category: 'snack', price: 200, icon: '🍭' },

  // 초코파이
  { name: '초코파이', category: 'snack', price: 500, icon: '🍫' },

  // 아이스크림
  { name: '아이스크림', category: 'snack', price: 1000, icon: '🍦' },

  // 삼각김밥
  { name: '삼각김밥', category: 'snack', price: 1200, icon: '🍙' },

  // 컵라면
  { name: '컵라면', category: 'snack', price: 1500, icon: '🍜' },

  // 문화상품권 5000원
  { name: '문상 5000권', category: 'voucher', price: 10000, icon: '💳' },

  // 에어팟
  { name: '에어팟', category: 'special', price: 300000, icon: '🎧' },
];

// ==================== 전역 변수 ====================
let allStudents = [];
let currentClass = '';
let currentGrade = 'elementary'; // 'elementary' or 'middle'

// ==================== 페이지 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  // 로그인 체크
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');

  if (userRole !== 'teacher') {
    alert('선생님만 접근 가능합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 선생님 이름 표시
  document.getElementById('teacherName').textContent = userName;

  // 오늘 날짜 표시
  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  document.getElementById('todayDate').textContent = dateStr;

  // 토스트 알림 설정
  toastr.options = {
    closeButton: true,
    progressBar: true,
    positionClass: 'toast-top-right',
    timeOut: 3000,
    showEasing: 'swing',
    hideEasing: 'linear',
    showMethod: 'fadeIn',
    hideMethod: 'fadeOut',
  };

  // 학생 데이터 로드
  await loadStudents();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 환영 메시지
  toastr.info(`안녕하세요, ${userName} 선생님!`, '환영합니다', {
    timeOut: 2000,
  });
});

// ==================== 학생 관리 ====================
async function loadStudents() {
  try {
    const result = await api.getStudents(currentClass || null);

    if (result.success) {
      allStudents = result.data;
      displayStudents(allStudents);
      updateSummary();
      updateStudentSelect();

      // DataTable 초기화
      initDataTable();
    } else {
      console.error('학생 데이터 로드 실패:', result.error);
      toastr.error('학생 데이터를 불러올 수 없습니다.', '오류');
    }
  } catch (error) {
    console.error('API 오류:', error);
    toastr.error('서버 연결에 실패했습니다.', '오류');
  }
}

// DataTable 초기화
function initDataTable() {
  if ($.fn.DataTable.isDataTable('#studentTable')) {
    $('#studentTable').DataTable().destroy();
  }

  setTimeout(() => {
    $('#studentTable').DataTable({
      language: {
        lengthMenu: '_MENU_ 명씩 보기',
        zeroRecords: '데이터가 없습니다',
        info: '전체 _TOTAL_명 중 _START_~_END_',
        infoEmpty: '데이터가 없습니다',
        infoFiltered: '(전체 _MAX_명 중 검색)',
        search: '검색:',
        paginate: {
          first: '처음',
          last: '마지막',
          next: '다음',
          previous: '이전',
        },
      },
      pageLength: 10,
      order: [[3, 'desc']],
      responsive: true,
    });

    document.getElementById('searchInput').style.display = 'none';
  }, 100);
}

// 학생 목록 표시
function displayStudents(students) {
  const tbody = document.getElementById('studentTableBody');

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px;">
          학생이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = students
    .map((student) => {
      // 학급으로 학년 판단 (초등: 4-6, 중등: 1-3)
      const grade =
        student.classId && student.classId[0] >= '4' ? 'elementary' : 'middle';
      const policy = POINT_POLICY[grade];

      return `
        <tr>
          <td>
            <div class="student-name">
              <div class="student-avatar">${student.avatar || '👤'}</div>
              <span>${student.name}</span>
            </div>
          </td>
          <td>${student.classId}</td>
          <td><span class="level-tag">${student.level}</span></td>
          <td><strong>${student.currentPoints.toLocaleString()}P</strong></td>
          <td>${student.savingsPoints.toLocaleString()}P</td>
          <td>
            <div class="quick-points">
              ${policy.earn.teacherSpecial
                .slice(0, 3)
                .map(
                  (points) =>
                    `<button class="point-btn" onclick="quickPoint('${student.studentId}', ${points}, '${student.name}')">+${points}</button>`
                )
                .join('')}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ==================== 포인트 정책 기반 액션 ====================
async function policyBasedAction(actionType, studentId = null) {
  const grade = detectGradeFromClass();
  const policy = POINT_POLICY[grade];

  switch (actionType) {
    case 'mathPerfect':
      if (grade === 'elementary') {
        await givePointsToStudent(
          studentId,
          policy.earn.mathPerfect,
          '연산 만점'
        );
      } else {
        toastr.warning('연산 만점은 초등학생만 해당됩니다.', '알림');
      }
      break;

    case 'homework':
      await givePointsToStudent(studentId, policy.earn.homework, '과제 완료');
      break;

    case 'levelTest':
      await givePointsToStudent(
        studentId,
        policy.earn.levelTest,
        '등급유지테스트 통과'
      );
      break;

    case 'noBook':
      await givePointsToStudent(studentId, policy.penalty.noBook, '책 미지참');
      break;

    case 'noHomework':
      await givePointsToStudent(
        studentId,
        policy.penalty.noHomework,
        '과제 미제출'
      );
      break;
  }
}

// 학급으로 학년 감지
function detectGradeFromClass() {
  // 현재 선택된 반 기준으로 초등/중등 구분
  if (currentClass && currentClass[0] >= '4') {
    return 'elementary';
  }
  return 'middle';
}

// 개별 학생 포인트 지급
async function givePointsToStudent(studentId, amount, reason) {
  if (!studentId) {
    toastr.warning('학생을 선택해주세요.', '알림');
    return;
  }

  try {
    const result = await api.addPoints(studentId, amount, 'manual', reason);

    if (result.success) {
      const student = allStudents.find((s) => s.studentId === studentId);
      const action = amount > 0 ? '지급' : '차감';

      toastr.success(
        `${student?.name || '학생'}님께 ${Math.abs(amount)}P ${action}`,
        '완료'
      );

      await loadStudents();
      updateCharts(amount);
    }
  } catch (error) {
    toastr.error('처리 중 오류가 발생했습니다.', '오류');
  }
}

// ==================== 빠른 액션 개선 ====================
async function quickAction(type) {
  const grade = detectGradeFromClass();
  const policy = POINT_POLICY[grade];

  switch (type) {
    case 'attendance':
      // 초등: 주2회 과제, 중등: 주3회 과제
      const confirmMsg =
        grade === 'elementary'
          ? '초등학생 전체에게 과제 포인트 100P를 지급하시겠습니까?'
          : '중학생 전체에게 과제 포인트 200P를 지급하시겠습니까?';

      if (confirm(confirmMsg)) {
        const points = policy.earn.homework;
        await batchGivePoints(points, '과제 완료');
      }
      break;

    case 'test':
      showPolicyModal('test');
      break;

    case 'homework':
      showPolicyModal('homework');
      break;

    case 'interest':
      // COFIX 기준 이자 계산
      const cofixRate = 3.5; // 연 3.5%
      const monthlyRate = cofixRate / 12 / 100;

      if (
        confirm(
          `이번 달 이자율은 ${(monthlyRate * 100).toFixed(
            2
          )}%입니다. 정산하시겠습니까?`
        )
      ) {
        await calculateAndGiveInterest(monthlyRate);
      }
      break;
  }
}

// 일괄 포인트 지급
async function batchGivePoints(amount, reason) {
  let successCount = 0;
  const totalCount = allStudents.length;

  const progressToast = toastr.info(
    `0/${totalCount}명 처리 중...`,
    '포인트 지급',
    { timeOut: 0, extendedTimeOut: 0 }
  );

  for (const student of allStudents) {
    await api.addPoints(student.studentId, amount, 'batch', reason);
    successCount++;

    progressToast
      .find('.toast-message')
      .text(`${successCount}/${totalCount}명 처리 중...`);
  }

  toastr.clear(progressToast);
  toastr.success(
    `전체 ${successCount}명에게 ${amount}P를 지급했습니다!`,
    '완료'
  );

  await loadStudents();
}

// 이자 계산 및 지급
async function calculateAndGiveInterest(rate) {
  let totalInterest = 0;

  for (const student of allStudents) {
    if (student.savingsPoints > 0) {
      const interest = Math.floor(student.savingsPoints * rate);
      if (interest > 0) {
        await api.addPoints(student.studentId, interest, 'interest', '월 이자');
        totalInterest += interest;
      }
    }
  }

  toastr.success(
    `총 ${totalInterest}P의 이자가 지급되었습니다.`,
    '이자 정산 완료'
  );

  await loadStudents();
}

// ==================== 정책 기반 모달 ====================
function showPolicyModal(type) {
  const modal = document.getElementById('pointModal');
  const grade = detectGradeFromClass();
  const policy = POINT_POLICY[grade];

  // 모달 타입에 따라 옵션 설정
  const typeSelect = document.getElementById('modalPointType');
  typeSelect.innerHTML = '';

  if (type === 'homework') {
    // 과제 관련 옵션
    typeSelect.innerHTML = `
      <option value="homework" data-points="${policy.earn.homework}">과제 완료 (+${policy.earn.homework}P)</option>
      <option value="noHomework" data-points="${policy.penalty.noHomework}">과제 미제출 (${policy.penalty.noHomework}P)</option>
      <option value="badHomework" data-points="${policy.penalty.badHomework}">과제 불성실 (${policy.penalty.badHomework}P)</option>
    `;
  } else if (type === 'test') {
    // 테스트 관련 옵션
    typeSelect.innerHTML = `
      <option value="levelTest" data-points="${
        policy.earn.levelTest
      }">등급테스트 통과 (+${policy.earn.levelTest}P)</option>
      <option value="writingExcellent" data-points="${
        policy.earn.writingExcellent
      }">서술형 우수자 (+${policy.earn.writingExcellent}P)</option>
      ${
        grade === 'elementary'
          ? `<option value="mathPerfect" data-points="${policy.earn.mathPerfect}">연산 만점 (+${policy.earn.mathPerfect}P)</option>
         <option value="mathTimeout" data-points="${policy.penalty.mathTimeout}">연산 시간초과 (${policy.penalty.mathTimeout}P)</option>`
          : ''
      }
    `;
  }

  // 포인트 자동 설정
  typeSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const points = selectedOption.getAttribute('data-points');
    document.getElementById('modalPointAmount').value = Math.abs(points);
  });

  modal.classList.add('active');
}

// ==================== 기존 함수 유지 ====================
function updateSummary() {
  document.getElementById('totalStudents').textContent =
    allStudents.length + '명';

  const todayPoints = Math.floor(Math.random() * 1000) + 500;
  document.getElementById('todayPoints').textContent = todayPoints + 'P';

  if (allStudents.length > 0) {
    const topStudent = allStudents.reduce((prev, current) =>
      prev.currentPoints > current.currentPoints ? prev : current
    );
    document.getElementById('weeklyTop').textContent = topStudent.name;
    document.getElementById('weeklyTopPoints').textContent =
      topStudent.currentPoints.toLocaleString() + 'P 획득';
  }
}

function updateStudentSelect() {
  const select = document.getElementById('modalStudentSelect');
  select.innerHTML = '<option value="">학생을 선택하세요</option>';

  allStudents.forEach((student) => {
    select.innerHTML += `
      <option value="${student.studentId}">
        ${student.name} (${student.classId})
      </option>
    `;
  });
}

function setupEventListeners() {
  // 반 선택
  document.getElementById('classSelector').addEventListener('change', (e) => {
    currentClass = e.target.value;
    currentGrade = detectGradeFromClass();
    toastr.info(`${e.target.value || '전체'} 반 데이터를 불러옵니다.`, '알림');
    loadStudents();
  });

  // 네비게이션
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document
        .querySelectorAll('.nav-item')
        .forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');

      const page = item.dataset.page;
      document.querySelector('.page-title').textContent =
        item.querySelector('span:last-child').textContent;
    });
  });
}

// 빠른 포인트 지급
async function quickPoint(studentId, amount, studentName) {
  try {
    const loadingToast = toastr.info('포인트 지급 중...', '처리중', {
      timeOut: 0,
      extendedTimeOut: 0,
      closeButton: false,
    });

    const result = await api.addPoints(
      studentId,
      amount,
      'manual',
      '빠른 지급'
    );

    toastr.clear(loadingToast);

    if (result.success) {
      toastr.success(
        `${studentName} 학생에게 ${amount}P를 지급했습니다!`,
        '지급 완료',
        { timeOut: 2000, progressBar: true }
      );

      updateCharts(amount);
      loadStudents();
    } else {
      toastr.error('지급 실패: ' + result.error, '오류');
    }
  } catch (error) {
    console.error('포인트 지급 오류:', error);
    toastr.error('포인트 지급 중 오류가 발생했습니다.', '오류');
  }
}

// 모달 관련
function showPointModal(studentId = null) {
  const modal = document.getElementById('pointModal');
  modal.classList.add('active');

  if (studentId) {
    document.getElementById('modalStudentSelect').value = studentId;
  }
}

function closeModal() {
  document.getElementById('pointModal').classList.remove('active');

  document.getElementById('modalStudentSelect').value = '';
  document.getElementById('modalPointType').value = 'attendance';
  document.getElementById('modalPointAmount').value = '';
  document.getElementById('modalPointReason').value = '';
}

async function submitPoints() {
  const studentId = document.getElementById('modalStudentSelect').value;
  const type = document.getElementById('modalPointType').value;
  const amount = document.getElementById('modalPointAmount').value;
  const reason = document.getElementById('modalPointReason').value;

  if (!studentId) {
    toastr.warning('학생을 선택해주세요.', '알림');
    return;
  }

  if (!amount || amount === 0) {
    toastr.warning('올바른 포인트를 입력해주세요.', '알림');
    return;
  }

  try {
    const submitBtn = document.querySelector('.modal-footer .btn-primary');
    submitBtn.innerHTML = '<span class="loading"></span> 처리중...';
    submitBtn.disabled = true;

    const result = await api.addPoints(studentId, amount, type, reason);

    if (result.success) {
      const student = allStudents.find((s) => s.studentId === studentId);
      const studentName = student ? student.name : '학생';

      toastr.success(
        `${studentName}에게 ${amount}P를 지급했습니다!`,
        '지급 완료',
        { timeOut: 3000 }
      );

      closeModal();
      loadStudents();
      updateCharts(parseInt(amount));
    } else {
      toastr.error('지급 실패: ' + result.error, '오류');
    }
  } catch (error) {
    console.error('포인트 지급 오류:', error);
    toastr.error('포인트 지급 중 오류가 발생했습니다.', '오류');
  } finally {
    const submitBtn = document.querySelector('.modal-footer .btn-primary');
    submitBtn.innerHTML = '지급하기';
    submitBtn.disabled = false;
  }
}

// 차트 업데이트
function updateCharts(amount) {
  const chartInstances = Chart.instances;

  if (chartInstances && chartInstances.length > 0) {
    const weeklyChart = chartInstances[0];
    if (weeklyChart) {
      const today = new Date().getDay();
      const dayIndex = today === 0 ? 4 : today === 6 ? 4 : today - 1;

      if (dayIndex >= 0 && dayIndex < 5) {
        weeklyChart.data.datasets[0].data[dayIndex] += amount;
        weeklyChart.update('active');
      }
    }

    const categoryChart = chartInstances[2];
    if (categoryChart) {
      const categoryIndex = 4;
      categoryChart.data.datasets[0].data[categoryIndex] += amount;
      categoryChart.update('active');
    }
  }
}

// 로그아웃
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    toastr.info('로그아웃 되었습니다.', '안녕히 가세요', {
      timeOut: 1000,
      onHidden: function () {
        localStorage.clear();
        window.location.href = '../login.html';
      },
    });
  }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// 모달 외부 클릭 시 닫기
document.getElementById('pointModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'pointModal') {
    closeModal();
  }
});
