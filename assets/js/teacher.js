// teacher.js - 포인트 정책이 반영된 선생님 페이지 (개선 버전)

// ==================== 포인트 정책 설정 ====================
const POINT_POLICY = {
  elementary: {
    earn: {
      mathPerfect: 50, // 연산 만점
      tamdalSite: 1, // 탐달 사고력 사이트
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

// ==================== 전역 변수 ====================
let allStudents = [];
let currentClass = '';
let currentGrade = 'elementary';
let selectedStudents = new Set(); // 선택된 학생 ID 저장
let currentSelectedClass = ''; // 현재 선택된 반 저장

// 🔽 여기에 추가
let CLASS_LIST = {
  elementary: [],
  middle: [],
};

// ==================== Supabase에서 반 목록 가져오기 ====================
async function loadClassListFromDB() {
  try {
    const result = await api.getClassList();

    if (result.success && result.data) {
      CLASS_LIST = result.data;
      updateClassSelector();

      const totalClasses =
        CLASS_LIST.elementary.length + CLASS_LIST.middle.length;
      console.log(`✅ ${totalClasses}개 반 로드 완료`);

      if (CLASS_LIST.elementary.length > 0) {
        console.log(
          `초등부: ${CLASS_LIST.elementary.map((c) => c.value).join(', ')}`
        );
      }
      if (CLASS_LIST.middle.length > 0) {
        console.log(
          `중등부: ${CLASS_LIST.middle.map((c) => c.value).join(', ')}`
        );
      }

      return true;
    } else {
      console.warn('반 목록을 가져올 수 없음');
      return false;
    }
  } catch (error) {
    console.error('반 목록 로드 실패:', error);
    toastr.warning('반 목록을 불러올 수 없습니다.', '경고');
    return false;
  }
}

// ==================== 반 선택 옵션 업데이트 ====================
function updateClassSelector() {
  const selector = document.getElementById('classSelector');
  if (!selector) return;

  const currentValue = selector.value;

  // 기존 옵션 초기화
  selector.innerHTML = '<option value="">전체 반</option>';

  // 초등부 그룹 추가
  if (CLASS_LIST.elementary && CLASS_LIST.elementary.length > 0) {
    const elementaryGroup = document.createElement('optgroup');
    elementaryGroup.label = '🎒 초등부';

    CLASS_LIST.elementary.forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.value;
      option.textContent = cls.label;
      elementaryGroup.appendChild(option);
    });

    selector.appendChild(elementaryGroup);
  }

  // 중등부 그룹 추가
  if (CLASS_LIST.middle && CLASS_LIST.middle.length > 0) {
    const middleGroup = document.createElement('optgroup');
    middleGroup.label = '📚 중등부';

    CLASS_LIST.middle.forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.value;
      option.textContent = cls.label;
      middleGroup.appendChild(option);
    });

    selector.appendChild(middleGroup);
  }

  // 이전 선택값 복원
  if (
    currentValue &&
    Array.from(selector.options).some((opt) => opt.value === currentValue)
  ) {
    selector.value = currentValue;
  } else {
    const lastSelectedClass = localStorage.getItem('lastSelectedClass');
    if (
      lastSelectedClass &&
      Array.from(selector.options).some(
        (opt) => opt.value === lastSelectedClass
      )
    ) {
      selector.value = lastSelectedClass;
      currentClass = lastSelectedClass;
    }
  }
}
// ==================== 페이지 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  const loginId = localStorage.getItem('loginId');
  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName');

  // 사용자 정보 표시
  document.getElementById('teacherName').textContent = userName || '선생님';

  // 원장 권한 체크
  if (loginId === 'ablemaster' || userRole === 'principal') {
    document.getElementById('adminSection').style.display = 'block';
    document.getElementById('userRole').textContent = '원장';
  } else {
    document.getElementById('userRole').textContent = '선생님';
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

  // 🆕 sessionStorage에서 선택된 반 복원
  const savedClass = sessionStorage.getItem('selectedClass');
  if (savedClass) {
    currentSelectedClass = savedClass;
    const classSelector = document.getElementById('classSelector');
    if (classSelector) {
      classSelector.value = savedClass;
      // 반 변경 이벤트 수동 트리거
      classSelector.dispatchEvent(new Event('change'));
    }
  }

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
  // 🔽 여기에 추가 (loadStudents() 전에)
  await loadClassListFromDB();

  // 학생 데이터 로드
  await loadStudents();

  // 이벤트 리스너 설정
  setupEventListeners();
  setupBulkActionButtons();

  // 환영 메시지
  toastr.info(`안녕하세요, ${userName} 선생님!`, '환영합니다', {
    timeOut: 2000,
  });
  // 🆕 빠른 액션 버튼 추가 - 맨 아래쪽에 추가
  addQuickActions();

  console.log('초기화 완료');
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
      updateBulkActionUI();
    } else {
      console.error('학생 데이터 로드 실패:', result.error);
      toastr.error('학생 데이터를 불러올 수 없습니다.', '오류');
    }
  } catch (error) {
    console.error('API 오류:', error);
    toastr.error('서버 연결에 실패했습니다.', '오류');
  }
}

// ==================== 체크박스가 포함된 학생 목록 표시 ====================
function displayStudents(students) {
  const tbody = document.getElementById('studentTableBody');

  if (students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          학생이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  // 헤더에 전체선택 체크박스 추가
  const thead = document.getElementById('studentTableHead');
  if (thead && !thead.querySelector('#selectAllCheckbox')) {
    const headerRow = thead.querySelector('tr');
    const checkHeader = document.createElement('th');
    checkHeader.innerHTML = `
      <input type="checkbox" id="selectAllCheckbox" 
             onchange="toggleAllStudents(this)">
    `;
    headerRow.insertBefore(checkHeader, headerRow.firstChild);
  }

  tbody.innerHTML = students
    .map((student) => {
      // 학급으로 학년 판단 (E로 시작하면 초등, 나머지는 중등)
      const isElementary = student.classId && student.classId.startsWith('E');
      const grade = isElementary ? 'elementary' : 'middle';
      const policy = POINT_POLICY[grade];

      return `
        <tr data-student-id="${student.studentId}" data-grade="${grade}">
          <td>
            <input type="checkbox" 
                   class="student-checkbox" 
                   data-id="${student.studentId}"
                   data-name="${student.name}"
                   data-grade="${grade}"
                   onchange="toggleStudent('${student.studentId}')">
          </td>
          <td>
            <div class="student-name">
              <div class="student-avatar">${student.avatar || '👤'}</div>
              <span>${student.name}</span>
            </div>
          </td>
          <td>${student.classId || '-'}</td>
          <td><span class="level-tag">${student.level || '씨앗'}</span></td>
          <td><strong>${student.currentPoints.toLocaleString()}P</strong></td>
          <td>${student.savingsPoints.toLocaleString()}P</td>
          <td>
            <div class="quick-points">
              <button class="point-btn action-math" 
                      onclick="quickPoint('${student.studentId}', 50, '${
        student.name
      }', '연산')"
                      ${!isElementary ? 'disabled style="opacity:0.3"' : ''}>
                연산
              </button>
              <button class="point-btn action-homework"
                      onclick="quickPoint('${student.studentId}', ${
        policy.earn.homework
      }, '${student.name}', '과제')">
                과제
              </button>
              <button class="point-btn action-penalty"
                      onclick="quickPoint('${student.studentId}', ${
        policy.penalty.noBook
      }, '${student.name}', '책미지참')">
                -책
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ==================== 체크박스 관리 ====================
function toggleStudent(studentId) {
  if (selectedStudents.has(studentId)) {
    selectedStudents.delete(studentId);
  } else {
    selectedStudents.add(studentId);
  }
  updateBulkActionUI();
}

function toggleAllStudents(checkbox) {
  const studentCheckboxes = document.querySelectorAll('.student-checkbox');

  selectedStudents.clear();

  if (checkbox.checked) {
    studentCheckboxes.forEach((cb) => {
      cb.checked = true;
      selectedStudents.add(cb.dataset.id);
    });
  } else {
    studentCheckboxes.forEach((cb) => {
      cb.checked = false;
    });
  }

  updateBulkActionUI();
}

// ==================== 일괄 처리 UI 업데이트 ====================
function updateBulkActionUI() {
  const selectedCount = selectedStudents.size;
  const bulkActionArea = document.getElementById('bulkActionArea');

  if (!bulkActionArea) return;

  if (selectedCount > 0) {
    bulkActionArea.innerHTML = `
      <div class="bulk-action-container">
        <div class="selected-info">
          <span class="selected-count">${selectedCount}명 선택</span>
        </div>
        <div class="bulk-action-buttons">
          <button class="bulk-btn bulk-math" onclick="bulkAction('mathPerfect')">
            연산 만점 (+50P)
          </button>
          <button class="bulk-btn bulk-homework" onclick="bulkAction('homework')">
            과제 완료 (+100/200P)
          </button>
          <button class="bulk-btn bulk-level" onclick="bulkAction('levelTest')">
            등급테스트 (+200/500P)
          </button>
          <button class="bulk-btn bulk-penalty" onclick="bulkAction('noBook')">
            책 미지참 (-200/300P)
          </button>
          <button class="bulk-btn bulk-no-homework" onclick="bulkAction('noHomework')">
            과제 미제출 (-500P)
          </button>
        </div>
      </div>
    `;
    bulkActionArea.style.display = 'block';
  } else {
    bulkActionArea.style.display = 'none';
  }
}

// ==================== 일괄 처리 실행 ====================
async function bulkAction(actionType) {
  if (selectedStudents.size === 0) {
    toastr.warning('학생을 선택해주세요.', '알림');
    return;
  }

  const students = Array.from(selectedStudents).map((id) => {
    const student = allStudents.find((s) => s.studentId === id);
    const isElementary = student.classId && student.classId.startsWith('E');
    const grade = isElementary ? 'elementary' : 'middle';
    return { ...student, grade };
  });

  // 초등/중등 분리
  const elementaryStudents = students.filter((s) => s.grade === 'elementary');
  const middleStudents = students.filter((s) => s.grade === 'middle');

  let successCount = 0;
  let failCount = 0;

  // 액션별 포인트 설정 및 사유
  const getPointsAndReason = (grade, actionType) => {
    const policy = POINT_POLICY[grade];

    switch (actionType) {
      case 'mathPerfect':
        return grade === 'elementary'
          ? { points: policy.earn.mathPerfect, reason: '연산 만점' }
          : null;
      case 'homework':
        return { points: policy.earn.homework, reason: '과제 완료' };
      case 'levelTest':
        return { points: policy.earn.levelTest, reason: '등급테스트 통과' };
      case 'noBook':
        return { points: policy.penalty.noBook, reason: '책 미지참' };
      case 'noHomework':
        return { points: policy.penalty.noHomework, reason: '과제 미제출' };
      default:
        return null;
    }
  };

  // 로딩 표시
  const loadingToast = toastr.info('일괄 처리 중...', '처리중', {
    timeOut: 0,
    extendedTimeOut: 0,
    closeButton: false,
  });

  // 처리 실행
  for (const student of students) {
    const pointInfo = getPointsAndReason(student.grade, actionType);

    if (!pointInfo) {
      // 해당 학년에 적용되지 않는 액션
      if (actionType === 'mathPerfect' && student.grade === 'middle') {
        continue; // 중등생은 연산 만점 제외
      }
      failCount++;
      continue;
    }

    try {
      // ✅ 수정: api.addPoints 호출 순서 변경
      const result = await api.addPoints(
        student.loginId || student.studentId, // loginId 사용
        pointInfo.points,
        pointInfo.points >= 0 ? 'earn' : 'penalty', // type
        pointInfo.reason // reason
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
    }
  }

  toastr.clear(loadingToast);

  // 결과 표시
  if (successCount > 0) {
    toastr.success(
      `${successCount}명 처리 완료${
        failCount > 0 ? `, ${failCount}명 실패` : ''
      }`,
      '일괄 처리 완료'
    );
  } else {
    toastr.error('일괄 처리에 실패했습니다.', '오류');
  }

  // 데이터 새로고침
  await loadStudents();

  // 선택 초기화
  selectedStudents.clear();
  document.getElementById('selectAllCheckbox').checked = false;
  updateBulkActionUI();
}

// ==================== 빠른 포인트 지급 (개별) ====================
async function quickPoint(studentId, amount, studentName, type = '빠른 지급') {
  try {
    const loadingToast = toastr.info('포인트 지급 중...', '처리중', {
      timeOut: 0,
      extendedTimeOut: 0,
      closeButton: false,
    });

    // ✅ 수정: studentId를 loginId로 사용 (또는 student 객체에서 loginId 찾기)
    const student = allStudents.find((s) => s.studentId === studentId);
    const result = await api.addPoints(
      student.loginId || studentId, // loginId 사용
      amount,
      amount >= 0 ? 'earn' : 'penalty', // type
      type // reason
    );

    toastr.clear(loadingToast);

    if (result.success) {
      const action = amount > 0 ? '지급' : '차감';
      toastr.success(
        `${studentName} 학생 ${Math.abs(amount)}P ${action} (${type})`,
        '처리 완료',
        { timeOut: 2000, progressBar: true }
      );

      loadStudents();
    } else {
      toastr.error('처리 실패: ' + result.error, '오류');
    }
  } catch (error) {
    console.error('포인트 지급 오류:', error);
    toastr.error('포인트 처리 중 오류가 발생했습니다.', '오류');
  }
}

// ==================== 포인트 지급 모달 ====================
let modalTargetStudents = []; // 모달에서 사용할 대상 학생 목록 저장

function showPointModal() {
  // 선택된 학생이 있으면 해당 학생들만, 없으면 전체
  modalTargetStudents =
    selectedStudents.size > 0
      ? Array.from(selectedStudents).map((id) =>
          allStudents.find((s) => s.studentId === id)
        )
      : allStudents;

  const targetStudents = modalTargetStudents;

  const modal = document.getElementById('pointModal');
  const studentSelect = document.getElementById('modalStudentSelect');

  // 학생 선택 옵션 업데이트
  studentSelect.innerHTML = `
    <option value="">학생을 선택하세요</option>
    <option value="all">전체 학생 (${targetStudents.length}명)</option>
    ${targetStudents
      .map(
        (s) => `
      <option value="${s.studentId}">${s.name} (${s.classId})</option>
    `
      )
      .join('')}
  `;

  // 포인트 타입 선택 업데이트
  const typeSelect = document.getElementById('modalPointType');
  const grade = detectGradeFromClass();
  const policy = POINT_POLICY[grade];

  typeSelect.innerHTML = `
    <optgroup label="획득">
      ${
        grade === 'elementary'
          ? `<option value="mathPerfect" data-points="${policy.earn.mathPerfect}">
          연산 만점 (+${policy.earn.mathPerfect}P)
        </option>`
          : ''
      }
      <option value="homework" data-points="${policy.earn.homework}">
        과제 완료 (+${policy.earn.homework}P)
      </option>
      <option value="levelTest" data-points="${policy.earn.levelTest}">
        등급테스트 통과 (+${policy.earn.levelTest}P)
      </option>
      <option value="writingExcellent" data-points="${
        policy.earn.writingExcellent
      }">
        서술형 우수자 (+${policy.earn.writingExcellent}P)
      </option>
      <option value="onlineComplete" data-points="${
        policy.earn.onlineComplete
      }">
        온라인 문제풀이 (+${policy.earn.onlineComplete}P)
      </option>
    </optgroup>
    <optgroup label="차감">
      <option value="noBook" data-points="${policy.penalty.noBook}">
        책 미지참 (${policy.penalty.noBook}P)
      </option>
      <option value="noHomework" data-points="${policy.penalty.noHomework}">
        과제 미제출 (${policy.penalty.noHomework}P)
      </option>
      ${
        grade === 'elementary'
          ? `<option value="mathTimeout" data-points="${policy.penalty.mathTimeout}">
          연산 시간초과 (${policy.penalty.mathTimeout}P)
        </option>`
          : ''
      }
    </optgroup>
    <optgroup label="기타">
      <option value="custom">직접 입력</option>
    </optgroup>
  `;

  // 포인트 자동 설정
  typeSelect.addEventListener('change', (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const points = selectedOption.getAttribute('data-points');
    if (points) {
      document.getElementById('modalPointAmount').value = Math.abs(points);
    } else {
      document.getElementById('modalPointAmount').value = '';
    }
  });

  modal.classList.add('active');
}

// ==================== 이벤트 리스너 설정 ====================
function setupEventListeners() {
  // 반 선택 - 이 부분 수정
  document.getElementById('classSelector').addEventListener('change', (e) => {
    currentClass = e.target.value;
    currentGrade = detectGradeFromClass();

    // 선택한 반 저장
    localStorage.setItem('lastSelectedClass', currentClass);

    // 🆕 sessionStorage에 저장 추가
    currentSelectedClass = e.target.value;
    sessionStorage.setItem('selectedClass', e.target.value);

    // 저장 확인 로그 (디버깅용)
    console.log('반 선택 저장:', e.target.value);

    // 반 이름 표시 개선
    const selectedOption = e.target.options[e.target.selectedIndex];
    const className = selectedOption ? selectedOption.textContent : '전체';

    toastr.info(`${className} 데이터를 불러옵니다.`, '알림');
    selectedStudents.clear();
    loadStudents();
  });

  // 네비게이션
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      // href가 있는 경우는 기본 동작 허용
      if (item.href && item.href !== '#') {
        return; // preventDefault 하지 않음
      }

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

// ==================== 일괄 액션 버튼 설정 ====================
function setupBulkActionButtons() {
  // 일괄 액션 영역 생성
  const quickActionsGrid = document.querySelector('.quick-actions-grid');
  if (quickActionsGrid) {
    const bulkActionDiv = document.createElement('div');
    bulkActionDiv.id = 'bulkActionArea';
    bulkActionDiv.style.display = 'none';
    bulkActionDiv.className = 'bulk-action-area';
    quickActionsGrid.parentElement.insertBefore(
      bulkActionDiv,
      quickActionsGrid.nextSibling
    );
  }
}

// ==================== 학년 감지 개선 ====================
function detectGradeFromClass() {
  if (!currentClass) return 'elementary';

  // 첫 글자로 판단
  if (currentClass[0] === 'E') {
    return 'elementary';
  } else if (currentClass[0] === 'M') {
    return 'middle';
  }

  return 'elementary';
}

// ==================== 기존 함수들 유지 ====================
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
  if (!select) return;

  select.innerHTML = '<option value="">학생을 선택하세요</option>';

  allStudents.forEach((student) => {
    select.innerHTML += `
      <option value="${student.studentId}">
        ${student.name} (${student.classId})
      </option>
    `;
  });
}

function closeModal() {
  const modal = document.getElementById('pointModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

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

// ==================== 디버깅용 ====================
function printClassList() {
  console.group('📚 현재 반 목록');

  if (CLASS_LIST.elementary.length > 0) {
    console.group('🎒 초등부');
    CLASS_LIST.elementary.forEach((cls) => {
      console.log(`${cls.value}: ${cls.label}`);
    });
    console.groupEnd();
  }

  if (CLASS_LIST.middle.length > 0) {
    console.group('📚 중등부');
    CLASS_LIST.middle.forEach((cls) => {
      console.log(`${cls.value}: ${cls.label}`);
    });
    console.groupEnd();
  }

  console.groupEnd();
}

// ==================== 포인트 지급 처리 (모달) ====================
async function submitPoints() {
  const studentSelect = document.getElementById('modalStudentSelect');
  const pointType = document.getElementById('modalPointType');
  const pointValue = document.getElementById('modalPointAmount');
  const pointReason = document.getElementById('modalPointReason');

  if (!studentSelect.value) {
    alert('학생을 선택해주세요.');
    return;
  }

  if (!pointValue.value) {
    alert('포인트를 입력해주세요.');
    return;
  }

  try {
    // 선택된 학생들 확인 (modalTargetStudents 사용)
    let targetStudents = [];
    if (studentSelect.value === 'all') {
      targetStudents = modalTargetStudents; // 모달에 표시된 학생들만 대상
    } else {
      const student = modalTargetStudents.find(
        (s) => s.studentId === studentSelect.value
      );
      if (student) targetStudents = [student];
    }

    if (targetStudents.length === 0) {
      alert('선택된 학생이 없습니다.');
      return;
    }

    // 로딩 표시
    const submitBtn = document.querySelector(
      '#pointModal .modal-footer .btn-primary'
    );
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '처리중...';
    }

    let successCount = 0;
    let failCount = 0;
    const amount = parseInt(pointValue.value);
    const reason = pointReason.value || '포인트 지급';

    // 각 학생에게 포인트 지급
    for (const student of targetStudents) {
      try {
        // 직접 Supabase에 삽입 (RLS 문제 우회)
        const transactionId =
          'TRX' + Date.now() + Math.random().toString(36).substr(2, 5);

        const { data, error } = await supabase
          .from('points')
          .insert({
            transaction_id: transactionId,
            student_id: student.studentId,
            amount: amount,
            type: amount >= 0 ? 'earn' : 'penalty',
            reason: reason,
            created_at: new Date().toISOString(),
          })
          .select();

        if (error) throw error;

        // students 테이블 업데이트
        const newCurrentPoints = student.currentPoints + amount;
        const newTotalPoints =
          amount > 0 ? student.totalPoints + amount : student.totalPoints;

        const { error: updateError } = await supabase
          .from('students')
          .update({
            current_points: newCurrentPoints,
            total_points: newTotalPoints,
            updated_at: new Date().toISOString(),
          })
          .eq('student_id', student.studentId);

        if (!updateError) {
          successCount++;
        } else {
          failCount++;
          console.error('Student update error:', updateError);
        }
      } catch (err) {
        console.error('학생별 처리 오류:', err);
        failCount++;
      }
    }

    // 결과 표시
    if (successCount > 0) {
      toastr.success(
        `${successCount}명에게 포인트를 지급했습니다.${
          failCount > 0 ? ` (${failCount}명 실패)` : ''
        }`,
        '처리 완료'
      );
      closeModal();
      await loadStudents(); // 목록 새로고침

      // 입력 필드 초기화
      pointValue.value = '';
      pointReason.value = '';
      studentSelect.value = '';
    } else {
      alert('포인트 지급에 실패했습니다.');
    }
  } catch (error) {
    console.error('포인트 지급 오류:', error);
    alert('오류가 발생했습니다: ' + error.message);
  } finally {
    const submitBtn = document.querySelector(
      '#pointModal .modal-footer .btn-primary'
    );
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '확인';
    }
    if (result.success) {
      // 차트 업데이트
      if (window.dashboardCharts) {
        window.dashboardCharts.updateAfterPoint(amount, reason);
      }
    }
  }
}

// ==================== 모달 닫기 함수 개선 ====================
function closeModal() {
  const modal = document.getElementById('pointModal');
  if (modal) {
    modal.classList.remove('active');
    // 입력 필드 초기화
    document.getElementById('modalStudentSelect').value = '';
    document.getElementById('modalPointAmount').value = '';
    document.getElementById('modalPointReason').value = '';
  }
}
// ==================== 구매 관리 관련 ====================

// 대시보드에서 미지급 구매 개수 실시간 업데이트
async function updatePendingPurchaseBadge() {
  try {
    if (typeof api !== 'undefined' && api.getPendingPurchasesCount) {
      const result = await api.getPendingPurchasesCount();

      if (result.success) {
        const badge = document.getElementById('pendingBadge');
        const count = result.data.count;

        if (badge) {
          if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline-block';

            // 5개 이상이면 애니메이션 추가
            if (count >= 5) {
              badge.style.animation = 'urgentBlink 2s infinite';
            } else {
              badge.style.animation = 'none';
            }
          } else {
            badge.style.display = 'none';
          }
        }

        // 대시보드 요약 카드도 업데이트
        const pendingCard = document.getElementById('pendingPurchases');
        if (pendingCard) {
          pendingCard.textContent = count + '건';
        }
      }
    }
  } catch (error) {
    console.error('미지급 구매 개수 업데이트 실패:', error);
  }
}

// 구매 관리 관련 초기화
document.addEventListener('DOMContentLoaded', () => {
  updatePendingPurchaseBadge();

  // 30초마다 업데이트
  setInterval(updatePendingPurchaseBadge, 30000);
});

// 페이지 포커스 시 업데이트
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    updatePendingPurchaseBadge();
  }
});

// 포인트 지급 관리 페이지로 이동
function goToPointHistory() {
  // 현재 반 선택 상태 저장
  if (currentClass) {
    sessionStorage.setItem('selectedClass', currentClass);
  }
  window.location.href = 'point-history.html';
}

// 페이지 복귀 시 스크롤 위치 저장
window.addEventListener('beforeunload', () => {
  sessionStorage.setItem('dashboardScrollY', window.scrollY);
});

// 페이지 로드 시 스크롤 위치 복원
window.addEventListener('load', () => {
  const scrollY = sessionStorage.getItem('dashboardScrollY');
  if (scrollY) {
    window.scrollTo(0, parseInt(scrollY));
    sessionStorage.removeItem('dashboardScrollY');
  }
});

// 🆕 빠른 액션 버튼 추가 함수 - 여기에 추가
function addQuickActions() {
  const quickActionsContainer = document.querySelector('.quick-actions-grid');
  if (quickActionsContainer) {
    // 기존 버튼들 뒤에 추가
    const historyButton = document.createElement('div');
    historyButton.className = 'quick-action';
    historyButton.innerHTML = `
            <div class="quick-action-icon">📊</div>
            <div class="quick-action-label">지급 내역 관리</div>
        `;
    historyButton.onclick = goToPointHistory;
    quickActionsContainer.appendChild(historyButton);
  }
}
