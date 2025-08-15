// teacher.js - 선생님 페이지 기능

// 전역 변수
let allStudents = [];
let currentClass = '';

// 페이지 로드 시 실행
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

// 학생 데이터 로드
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

// DataTable 초기화 함수
function initDataTable() {
  // 기존 DataTable이 있으면 제거
  if ($.fn.DataTable.isDataTable('#studentTable')) {
    $('#studentTable').DataTable().destroy();
  }

  // 새로 초기화
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
      order: [[3, 'desc']], // 포인트 기준 정렬
      responsive: true,
      dom: 'Bfrtip',
      buttons: [
        {
          extend: 'excel',
          text: '📥 엑셀 다운로드',
          className: 'btn btn-success btn-sm',
          exportOptions: {
            columns: [0, 1, 2, 3, 4], // 빠른 지급 버튼 제외
          },
        },
      ],
    });

    // 기존 검색 input 숨기기 (DataTable 검색 사용)
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
    .map(
      (student) => `
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
              <button class="point-btn" onclick="quickPoint('${
                student.studentId
              }', 10, '${student.name}')">+10</button>
              <button class="point-btn" onclick="quickPoint('${
                student.studentId
              }', 20, '${student.name}')">+20</button>
              <button class="point-btn" onclick="quickPoint('${
                student.studentId
              }', 50, '${student.name}')">+50</button>
            </div>
          </td>
        </tr>
      `
    )
    .join('');
}

// 요약 정보 업데이트
function updateSummary() {
  // 총 학생 수
  document.getElementById('totalStudents').textContent =
    allStudents.length + '명';

  // 오늘 발행 포인트 (샘플)
  const todayPoints = Math.floor(Math.random() * 1000) + 500;
  document.getElementById('todayPoints').textContent = todayPoints + 'P';

  // 이번 주 1등 찾기
  if (allStudents.length > 0) {
    const topStudent = allStudents.reduce((prev, current) =>
      prev.currentPoints > current.currentPoints ? prev : current
    );
    document.getElementById('weeklyTop').textContent = topStudent.name;
    document.getElementById('weeklyTopPoints').textContent =
      topStudent.currentPoints.toLocaleString() + 'P 획득';
  }
}

// 학생 선택 옵션 업데이트
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

// 이벤트 리스너 설정
function setupEventListeners() {
  // 반 선택
  document.getElementById('classSelector').addEventListener('change', (e) => {
    currentClass = e.target.value;
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
  // 즉시 지급 (confirm 없이)
  try {
    // 로딩 토스트
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

    // 로딩 토스트 제거
    toastr.clear(loadingToast);

    if (result.success) {
      // 성공 토스트
      toastr.success(
        `${studentName} 학생에게 ${amount}P를 지급했습니다!`,
        '지급 완료',
        {
          timeOut: 2000,
          progressBar: true,
        }
      );

      // 차트 업데이트
      updateCharts(amount);

      // 테이블 새로고침
      loadStudents();
    } else {
      toastr.error('지급 실패: ' + result.error, '오류');
    }
  } catch (error) {
    console.error('포인트 지급 오류:', error);
    toastr.error('포인트 지급 중 오류가 발생했습니다.', '오류');
  }
}

// 빠른 액션
async function quickAction(type) {
  switch (type) {
    case 'attendance':
      // 전체 출석 처리
      const confirmAttendance = confirm(
        '전체 학생에게 출석 포인트 10P를 지급하시겠습니까?'
      );
      if (confirmAttendance) {
        let successCount = 0;
        const totalCount = allStudents.length;

        // 프로그레스 토스트
        const progressToast = toastr.info(
          `0/${totalCount}명 처리 중...`,
          '출석 포인트 지급',
          { timeOut: 0, extendedTimeOut: 0 }
        );

        for (let i = 0; i < allStudents.length; i++) {
          const student = allStudents[i];
          await api.addPoints(student.studentId, 10, 'attendance', '출석');
          successCount++;

          // 프로그레스 업데이트
          progressToast
            .find('.toast-message')
            .text(`${successCount}/${totalCount}명 처리 중...`);
        }

        toastr.clear(progressToast);
        toastr.success(
          `전체 ${successCount}명에게 출석 포인트를 지급했습니다!`,
          '완료',
          { timeOut: 3000 }
        );

        loadStudents();
        updateCharts(10 * successCount);
      }
      break;

    case 'test':
      showPointModal();
      document.getElementById('modalPointType').value = 'test';
      toastr.info('시험 점수를 입력해주세요.', '알림');
      break;

    case 'homework':
      showPointModal();
      document.getElementById('modalPointType').value = 'homework';
      toastr.info('숙제 포인트를 지급해주세요.', '알림');
      break;

    case 'interest':
      toastr.warning('이자 정산 기능은 준비 중입니다.', '준비중', {
        timeOut: 2000,
      });
      break;
  }
}

// 모달 열기
function showPointModal(studentId = null) {
  const modal = document.getElementById('pointModal');
  modal.classList.add('active');

  if (studentId) {
    document.getElementById('modalStudentSelect').value = studentId;
  }
}

// 모달 닫기
function closeModal() {
  document.getElementById('pointModal').classList.remove('active');

  // 폼 초기화
  document.getElementById('modalStudentSelect').value = '';
  document.getElementById('modalPointType').value = 'attendance';
  document.getElementById('modalPointAmount').value = '';
  document.getElementById('modalPointReason').value = '';
}

// 포인트 지급
async function submitPoints() {
  const studentId = document.getElementById('modalStudentSelect').value;
  const type = document.getElementById('modalPointType').value;
  const amount = document.getElementById('modalPointAmount').value;
  const reason = document.getElementById('modalPointReason').value;

  if (!studentId) {
    toastr.warning('학생을 선택해주세요.', '알림');
    return;
  }

  if (!amount || amount <= 0) {
    toastr.warning('올바른 포인트를 입력해주세요.', '알림');
    return;
  }

  try {
    // 로딩 표시
    const submitBtn = document.querySelector('.modal-footer .btn-primary');
    submitBtn.innerHTML = '<span class="loading"></span> 처리중...';
    submitBtn.disabled = true;

    const result = await api.addPoints(studentId, amount, type, reason);

    if (result.success) {
      // 학생 이름 찾기
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
    // 버튼 복구
    const submitBtn = document.querySelector('.modal-footer .btn-primary');
    submitBtn.innerHTML = '지급하기';
    submitBtn.disabled = false;
  }
}

// 차트 업데이트 함수
function updateCharts(amount) {
  // Chart.js 인스턴스 가져오기
  const chartInstances = Chart.instances;

  if (chartInstances && chartInstances.length > 0) {
    // 1. 주간 차트 업데이트
    const weeklyChart = chartInstances[0];
    if (weeklyChart) {
      const today = new Date().getDay();
      const dayIndex = today === 0 ? 4 : today === 6 ? 4 : today - 1;

      if (dayIndex >= 0 && dayIndex < 5) {
        weeklyChart.data.datasets[0].data[dayIndex] += amount;
        weeklyChart.update('active');
      }
    }

    // 3. 카테고리 차트 업데이트 (막대 차트)
    const categoryChart = chartInstances[2];
    if (categoryChart) {
      // 출석, 숙제, 시험, 태도, 특별 순서
      const categoryIndex = 4; // 특별 포인트로 기본 설정
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
