// ==================== 선생님 관리 기능 ====================

let teachers = [];
let currentEditId = null;

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  // 권한 체크
  const userRole = localStorage.getItem('userRole');
  const loginId = localStorage.getItem('loginId');

  // ablemaster 계정인지 확인
  if (loginId !== 'ablemaster' && userRole !== 'principal') {
    alert('원장님만 접근 가능합니다.');
    window.location.href = 'index.html';
    return;
  }

  // 초기 원장 계정 생성 체크
  await ensurePrincipalAccount();
  await loadTeachers();
  updateStatistics();
});

// 초기 원장 계정 확인 및 생성
async function ensurePrincipalAccount() {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('login_id', 'ablemaster')
      .single();

    if (!existing) {
      // ablemaster 계정이 없으면 생성
      const { error } = await supabase.from('users').insert({
        user_id: 'USR_PRINCIPAL_001',
        login_id: 'ablemaster',
        password: 'able1234',
        name: '원장',
        role: 'principal',
        is_active: true,
        created_at: new Date().toISOString(),
      });

      if (!error) {
        console.log('원장 계정 생성 완료: ablemaster');
      }
    }
  } catch (error) {
    console.error('원장 계정 확인 오류:', error);
  }
}

// 선생님 목록 로드
async function loadTeachers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['teacher', 'principal'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    teachers = data || [];
    displayTeachers();
  } catch (error) {
    console.error('선생님 목록 로드 실패:', error);
  }
}

// 선생님 목록 표시
function displayTeachers() {
  const tbody = document.getElementById('teacherTableBody');

  if (teachers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-text">등록된 선생님이 없습니다</div>
          <div class="empty-state-subtext">선생님을 등록해주세요</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = teachers
    .map(
      (teacher) => `
    <tr>
      <td><strong>${teacher.name}</strong></td>
      <td>${teacher.login_id}</td>
      <td>
        <span class="role-badge role-${teacher.role}">
          ${teacher.role === 'principal' ? '원장' : '선생님'}
        </span>
      </td>
      <td>${getTeacherClasses(teacher.user_id)}</td>
      <td>
        <span class="status-badge status-${
          teacher.is_active !== false ? 'active' : 'inactive'
        }">
          ${teacher.is_active !== false ? '활성' : '비활성'}
        </span>
      </td>
      <td>${formatDate(teacher.created_at)}</td>
      <td>
        <div class="action-buttons">
          ${
            teacher.login_id !== 'ablemaster'
              ? `
            <button class="btn-edit" onclick="editTeacher('${
              teacher.user_id
            }')">
              수정
            </button>
            <button class="btn-reset" onclick="resetPassword('${
              teacher.user_id
            }')">
              비밀번호
            </button>
            <button class="btn-toggle" onclick="toggleStatus('${
              teacher.user_id
            }')">
              ${teacher.is_active !== false ? '비활성화' : '활성화'}
            </button>
          `
              : '<span style="color: #9ca3af;">-</span>'
          }
        </div>
      </td>
    </tr>
  `
    )
    .join('');
}

// 통계 업데이트
function updateStatistics() {
  const total = teachers.length;
  const active = teachers.filter((t) => t.is_active !== false).length;

  document.getElementById('totalTeachers').textContent = `${total}명`;
  document.getElementById('activeTeachers').textContent = `${active}명`;
}

// 선생님 등록 모달 표시
function showAddTeacherModal() {
  document.getElementById('addTeacherModal').classList.add('active');
  generatePassword();
}

// 모달 닫기
function closeModal() {
  document.getElementById('addTeacherModal').classList.remove('active');
  resetForm();
}

// 폼 초기화
function resetForm() {
  document.getElementById('teacherName').value = '';
  document.getElementById('teacherId').value = '';
  document.getElementById('teacherPassword').value = '';
  document.getElementById('teacherRole').value = 'teacher';
  document.getElementById('teacherPhone').value = '';
  currentEditId = null;
}

// 비밀번호 자동생성
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById('teacherPassword').value = password;
}

// 선생님 등록
async function registerTeacher() {
  const name = document.getElementById('teacherName').value;
  const loginId = document.getElementById('teacherId').value;
  const password = document.getElementById('teacherPassword').value;
  const role = document.getElementById('teacherRole').value;
  const phone = document.getElementById('teacherPhone').value;

  if (!name || !loginId || !password) {
    alert('필수 정보를 입력해주세요.');
    return;
  }

  try {
    // 아이디 중복 체크
    const { data: existing } = await supabase
      .from('users')
      .select('login_id')
      .eq('login_id', loginId);

    if (existing && existing.length > 0) {
      alert('이미 사용 중인 아이디입니다.');
      return;
    }

    const userId = 'USR' + Date.now();

    const { error } = await supabase.from('users').insert({
      user_id: userId,
      login_id: loginId,
      password: password,
      name: name,
      role: role,
      phone: phone,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    alert(
      `선생님이 등록되었습니다.\n아이디: ${loginId}\n비밀번호: ${password}`
    );
    closeModal();
    await loadTeachers();
    updateStatistics();
  } catch (error) {
    console.error('선생님 등록 실패:', error);
    alert('등록 중 오류가 발생했습니다.');
  }
}

// 비밀번호 초기화
async function resetPassword(userId) {
  if (!confirm('비밀번호를 초기화하시겠습니까?')) return;

  const newPassword = Math.random().toString(36).substring(2, 10).toUpperCase();

  try {
    const { error } = await supabase
      .from('users')
      .update({ password: newPassword })
      .eq('user_id', userId);

    if (error) throw error;

    alert(`비밀번호가 초기화되었습니다.\n새 비밀번호: ${newPassword}`);
  } catch (error) {
    console.error('비밀번호 초기화 실패:', error);
    alert('초기화 중 오류가 발생했습니다.');
  }
}

// 상태 토글
async function toggleStatus(userId) {
  const teacher = teachers.find((t) => t.user_id === userId);
  const newStatus = teacher.is_active === false;
  const action = newStatus ? '활성화' : '비활성화';

  if (!confirm(`${teacher.name} 선생님을 ${action}하시겠습니까?`)) return;

  try {
    const { error } = await supabase
      .from('users')
      .update({ is_active: newStatus })
      .eq('user_id', userId);

    if (error) throw error;

    await loadTeachers();
    updateStatistics();
  } catch (error) {
    console.error('상태 변경 실패:', error);
    alert('상태 변경 중 오류가 발생했습니다.');
  }
}

// 선생님 수정
function editTeacher(userId) {
  alert('수정 기능은 준비 중입니다.');
}

// 담당 클래스 가져오기
function getTeacherClasses(userId) {
  // 실제로는 DB에서 조회
  return '-';
}

// 날짜 포맷
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR');
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
document.getElementById('addTeacherModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'addTeacherModal') {
    closeModal();
  }
});
