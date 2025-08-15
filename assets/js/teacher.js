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

  // 학생 데이터 로드
  await loadStudents();

  // 이벤트 리스너 설정
  setupEventListeners();
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
    } else {
      console.error('학생 데이터 로드 실패:', result.error);
    }
  } catch (error) {
    console.error('API 오류:', error);
  }
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
            <td><strong>${student.currentPoints}P</strong></td>
            <td>${student.savingsPoints}P</td>
            <td>
                <div class="quick-points">
                    <button class="point-btn" onclick="quickPoint('${
                      student.studentId
                    }', 10)">+10</button>
                    <button class="point-btn" onclick="quickPoint('${
                      student.studentId
                    }', 20)">+20</button>
                    <button class="point-btn" onclick="quickPoint('${
                      student.studentId
                    }', 50)">+50</button>
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

  // 이번 주 1등 찾기
  if (allStudents.length > 0) {
    const topStudent = allStudents.reduce((prev, current) =>
      prev.currentPoints > current.currentPoints ? prev : current
    );
    document.getElementById('weeklyTop').textContent = topStudent.name;
    document.getElementById('weeklyTopPoints').textContent =
      topStudent.currentPoints + 'P 획득';
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
    loadStudents();
  });

  // 검색
  document.getElementById('searchInput').addEventListener('keyup', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allStudents.filter((student) =>
      student.name.toLowerCase().includes(query)
    );
    displayStudents(filtered);
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
async function quickPoint(studentId, amount) {
  if (confirm(`${amount}P를 지급하시겠습니까?`)) {
    try {
      const result = await api.addPoints(
        studentId,
        amount,
        'manual',
        '빠른 지급'
      );

      if (result.success) {
        alert('포인트가 지급되었습니다.');
        loadStudents(); // 새로고침
      } else {
        alert('지급 실패: ' + result.error);
      }
    } catch (error) {
      console.error('포인트 지급 오류:', error);
      alert('포인트 지급 중 오류가 발생했습니다.');
    }
  }
}

// 빠른 액션
async function quickAction(type) {
  switch (type) {
    case 'attendance':
      if (confirm('전체 학생에게 출석 포인트 10P를 지급하시겠습니까?')) {
        for (let student of allStudents) {
          await api.addPoints(student.studentId, 10, 'attendance', '출석');
        }
        alert('출석 포인트가 지급되었습니다.');
        loadStudents();
      }
      break;

    case 'test':
      showPointModal();
      document.getElementById('modalPointType').value = 'test';
      break;

    case 'homework':
      showPointModal();
      document.getElementById('modalPointType').value = 'homework';
      break;

    case 'interest':
      alert('이자 정산 기능은 준비 중입니다.');
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
    alert('학생을 선택해주세요.');
    return;
  }

  if (!amount || amount <= 0) {
    alert('올바른 포인트를 입력해주세요.');
    return;
  }

  try {
    const result = await api.addPoints(studentId, amount, type, reason);

    if (result.success) {
      alert('포인트가 지급되었습니다.');
      closeModal();
      loadStudents(); // 새로고침
    } else {
      alert('지급 실패: ' + result.error);
    }
  } catch (error) {
    console.error('포인트 지급 오류:', error);
    alert('포인트 지급 중 오류가 발생했습니다.');
  }
}

// 로그아웃
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
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
