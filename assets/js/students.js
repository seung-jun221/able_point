// ==================== 학생 관리 기능 ====================

let students = [];
let classes = [];
let currentEditId = null;

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  const loginId = localStorage.getItem('loginId');
  const userRole = localStorage.getItem('userRole');

  if (loginId !== 'ablemaster' && userRole !== 'principal') {
    alert('원장님만 접근 가능합니다.');
    window.location.href = 'index.html';
    return;
  }

  await loadClasses();
  await loadStudents();
  updateStatistics();
  setupEventListeners();
});

// 클래스 목록 로드
async function loadClasses() {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('class_code');

    if (error) throw error;

    classes = data || [];
    updateClassSelects();
  } catch (error) {
    console.error('클래스 목록 로드 실패:', error);
  }
}

// 클래스 셀렉트 업데이트
function updateClassSelects() {
  const classFilter = document.getElementById('classFilter');
  const studentClass = document.getElementById('studentClass');

  const options =
    '<option value="">선택</option>' +
    classes
      .map(
        (c) => `
      <option value="${c.class_id}">${c.class_name} (${
          c.class_code || ''
        })</option>
    `
      )
      .join('');

  if (classFilter) {
    classFilter.innerHTML =
      '<option value="">전체 클래스</option>' +
      classes
        .map(
          (c) => `
        <option value="${c.class_id}">${c.class_name}</option>
      `
        )
        .join('');
  }

  if (studentClass) {
    studentClass.innerHTML = options;
  }
}

// students.js의 loadStudents 함수 수정
async function loadStudents() {
  try {
    // 간단한 쿼리로 변경
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (userError) throw userError;

    // student_details 별도 조회
    const { data: detailsData } = await supabase
      .from('student_details')
      .select('*, classes(class_name, class_code)');

    // 데이터 병합
    students = userData.map((user) => {
      const details = detailsData?.find((d) => d.user_id === user.user_id);
      return {
        ...user,
        class_id: details?.class_id,
        class_name: details?.classes?.class_name || '-',
        current_points: details?.current_points || 0,
      };
    });

    displayStudents();
  } catch (error) {
    console.error('학생 목록 로드 실패:', error);
  }
}

// 학생 목록 표시
function displayStudents(filteredStudents = null) {
  const tbody = document.getElementById('studentTableBody');
  const displayData = filteredStudents || students;

  if (displayData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">🎓</div>
          <div class="empty-state-text">등록된 학생이 없습니다</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = displayData
    .map(
      (student) => `
  <tr>
    <td><strong>${student.name}</strong></td>
    <td>${student.login_id}</td>
    <td>${student.class_name || '-'}</td>
    <td>${student.current_points || 0}P</td>
    <td>${student.phone || '-'}</td>
    <td>${formatDate(student.created_at)}</td>
    <td>
      <div class="action-buttons">
        <button class="btn-edit" onclick="editStudent('${student.user_id}')">
          수정
        </button>
        <button class="btn-reset" onclick="resetPassword('${student.user_id}')">
          비밀번호
        </button>
        <button class="btn-delete-danger" onclick="deleteStudent('${
          student.user_id
        }')">
          삭제
        </button>
      </div>
    </td>
  </tr>
`
    )
    .join('');
}

// 통계 업데이트
function updateStatistics() {
  const total = students.length;
  const active = students.filter((s) => s.is_active !== false).length;

  // 이번 달 신규
  const thisMonth = new Date().getMonth();
  const newThisMonth = students.filter((s) => {
    const created = new Date(s.created_at);
    return created.getMonth() === thisMonth;
  }).length;

  document.getElementById('totalStudents').textContent = `${total}명`;
  document.getElementById('activeStudents').textContent = `${active}명`;
  document.getElementById('newStudents').textContent = `${newThisMonth}명`;
}

// 학생 등록 모달
function showAddStudentModal() {
  document.getElementById('modalTitle').textContent = '학생 등록';
  document.getElementById('studentModal').classList.add('active');
  currentEditId = null;
  resetForm();
}

// saveStudent 함수도 수정 필요 (update 처리 추가)
async function saveStudent() {
  const name = document.getElementById('studentName').value;
  const loginId = document.getElementById('studentLoginId').value;
  const password = document.getElementById('studentPassword').value;
  const classId = document.getElementById('studentClass').value;
  const phone = document.getElementById('studentPhone').value;
  const parentPhone = document.getElementById('parentPhone').value;
  const initialPoints = document.getElementById('initialPoints').value;

  if (!name || !loginId || !classId) {
    alert('필수 정보를 입력해주세요.');
    return;
  }

  if (!currentEditId && !password) {
    alert('신규 등록 시 비밀번호는 필수입니다.');
    return;
  }

  try {
    if (currentEditId) {
      // ============= 기존 학생 수정 - 변경사항 없음 =============
      // users 테이블 업데이트
      const updateData = {
        name: name,
        login_id: loginId,
        phone: phone,
        parent_phone: parentPhone,
      };

      if (password) {
        updateData.password = password;
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('user_id', currentEditId);

      if (error) throw error;

      // students 테이블 업데이트 (실제 테이블)
      const { error: studentError } = await supabase
        .from('students')
        .update({
          class_id: classId,
          name: name, // ✅ students 테이블의 name도 업데이트
        })
        .eq('user_id', currentEditId);

      // 에러 무시 (students 테이블이 없을 수도 있음)

      alert('학생 정보가 수정되었습니다.');
    } else {
      // ============= 신규 등록 - 수정된 부분 =============
      const userId = 'USR' + Date.now();
      const studentId = 'STU' + Date.now();

      const { data: existing } = await supabase
        .from('users')
        .select('login_id')
        .eq('login_id', loginId);

      if (existing && existing.length > 0) {
        alert('이미 사용 중인 아이디입니다.');
        return;
      }

      // users 테이블에 저장
      const { error } = await supabase.from('users').insert({
        user_id: userId,
        login_id: loginId,
        password: password,
        name: name,
        role: 'student',
        phone: phone,
        parent_phone: parentPhone,
      });

      if (error) throw error;

      // ✅ students 테이블에 저장 - 포인트 필드 추가!
      const pointValue = parseInt(initialPoints) || 0;

      const { error: studentError } = await supabase.from('students').insert({
        student_id: studentId,
        user_id: userId,
        name: name, // ✅ students 테이블에도 name 필드 추가
        class_id: classId,
        current_points: pointValue, // ✅ 초기 포인트 설정
        total_points: pointValue, // ✅ 초기 포인트 설정
        savings_points: 0, // ✅ 저축 포인트는 0으로 시작
        level: '씨앗', // ✅ 기본 레벨 설정
        avatar: '🦁', // ✅ 기본 아바타 설정
      });

      // students 테이블 에러 처리 (선택사항)
      if (studentError) {
        console.error('Students 테이블 저장 오류:', studentError);
        // users 테이블 롤백을 원하면 아래 주석 해제
        // await supabase.from('users').delete().eq('user_id', userId);
        // throw studentError;
      }

      // ✅ 초기 포인트가 있으면 points 테이블에 이력 추가
      if (pointValue > 0 && !studentError) {
        const transactionId =
          'TRX' + Date.now() + Math.random().toString(36).substr(2, 5);

        const { error: pointError } = await supabase.from('points').insert({
          transaction_id: transactionId,
          student_id: studentId,
          amount: pointValue,
          type: 'earn',
          reason: '신규 등록 초기 포인트',
          created_at: new Date().toISOString(),
        });

        if (pointError) {
          console.error('포인트 이력 저장 오류:', pointError);
        }
      }

      alert(
        `학생이 등록되었습니다.${
          pointValue > 0 ? `\n초기 포인트 ${pointValue}P가 지급되었습니다.` : ''
        }`
      );
    }

    closeModal();
    await loadStudents();
    updateStatistics();
  } catch (error) {
    console.error('학생 저장 실패:', error);
    alert('저장 중 오류가 발생했습니다.');
  }
}

// 학생 정보 수정
function editStudent(userId) {
  const student = students.find((s) => s.user_id === userId);
  if (!student) return;

  document.getElementById('modalTitle').textContent = '학생 정보 수정';
  document.getElementById('studentModal').classList.add('active');

  // 폼에 데이터 채우기
  document.getElementById('studentName').value = student.name;
  document.getElementById('studentLoginId').value = student.login_id;
  document.getElementById('studentPassword').value = ''; // 비밀번호는 표시하지 않음
  document.getElementById('studentClass').value = student.class_id || '';
  document.getElementById('studentPhone').value = student.phone || '';
  document.getElementById('parentPhone').value = student.parent_phone || '';
  document.getElementById('initialPoints').value = student.current_points || 0;

  currentEditId = userId;
}

// 비밀번호 초기화
async function resetPassword(userId) {
  if (!confirm('비밀번호를 1234로 초기화하시겠습니까?')) return;

  try {
    const { error } = await supabase
      .from('users')
      .update({ password: '1234' })
      .eq('user_id', userId);

    if (error) throw error;

    alert('비밀번호가 1234로 초기화되었습니다.');
  } catch (error) {
    console.error('비밀번호 초기화 실패:', error);
    alert('초기화 중 오류가 발생했습니다.');
  }
}

// 학생 삭제
async function deleteStudent(userId) {
  if (!confirm('정말 삭제하시겠습니까?\n관련된 모든 데이터가 삭제됩니다.'))
    return;

  try {
    // student_details 먼저 삭제
    await supabase.from('student_details').delete().eq('user_id', userId);

    // users 삭제
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    alert('학생이 삭제되었습니다.');
    await loadStudents();
    updateStatistics();
  } catch (error) {
    console.error('학생 삭제 실패:', error);
    alert('삭제 중 오류가 발생했습니다.');
  }
}

// 검색 및 필터
function setupEventListeners() {
  // 검색
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = students.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.login_id.toLowerCase().includes(query)
    );
    displayStudents(filtered);
  });

  // 클래스 필터
  document.getElementById('classFilter')?.addEventListener('change', (e) => {
    const classId = e.target.value;
    const filtered = classId
      ? students.filter((s) => s.class_id === classId)
      : students;
    displayStudents(filtered);
  });
}

// 유틸리티 함수들
function closeModal() {
  document.getElementById('studentModal').classList.remove('active');
  resetForm();
}

function resetForm() {
  document.getElementById('studentName').value = '';
  document.getElementById('studentLoginId').value = '';
  document.getElementById('studentPassword').value = '1234';
  document.getElementById('studentClass').value = '';
  document.getElementById('studentPhone').value = '';
  document.getElementById('parentPhone').value = '';
  document.getElementById('initialPoints').value = '0';
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('ko-KR');
}

function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}
