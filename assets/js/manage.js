// manage.js - 선생님 관리 기능 (최종 수정판)

// ==================== 전역 변수 ====================
let teachers = [];
let currentEditId = null;

// ==================== 페이지 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('선생님 관리 페이지 초기화 시작');

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

// ==================== 초기 원장 계정 확인 및 생성 ====================
async function ensurePrincipalAccount() {
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('login_id', 'ablemaster')
      .maybeSingle();

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

// ==================== 선생님 목록 로드 ====================
async function loadTeachers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('role', ['teacher', 'principal'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    teachers = data || [];
    console.log('로드된 선생님 목록:', teachers);
    displayTeachers();
  } catch (error) {
    console.error('선생님 목록 로드 실패:', error);
  }
}

// ==================== 선생님 목록 표시 (담당 클래스 제거) ====================
function displayTeachers() {
  const tbody = document.getElementById('teacherTableBody');

  if (!tbody) {
    console.error('teacherTableBody 요소를 찾을 수 없습니다.');
    return;
  }

  if (teachers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
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
      <td>
        <span class="status-badge status-${
          teacher.is_active !== false ? 'active' : 'inactive'
        }">
          ${teacher.is_active !== false ? '활성' : '비활성'}
        </span>
      </td>
      <td>${formatDate(teacher.created_at)}</td>
      <td>
        ${
          teacher.login_id !== 'ablemaster'
            ? `
          <div class="teacher-action-buttons">
            <button class="btn-teacher-action btn-edit" onclick="editTeacher('${
              teacher.user_id
            }')">
              수정
            </button>
            <button class="btn-teacher-action btn-password" onclick="showPasswordModal('${
              teacher.user_id
            }')">
              비밀번호
            </button>
            <button class="btn-teacher-action btn-toggle" onclick="toggleStatus('${
              teacher.user_id
            }')">
              ${teacher.is_active !== false ? '비활성화' : '활성화'}
            </button>
          </div>
        `
            : '<span style="color: #9ca3af; text-align: center; display: block;">-</span>'
        }
      </td>
    </tr>
  `
    )
    .join('');
}

// ==================== 통계 업데이트 ====================
function updateStatistics() {
  const total = teachers.length;
  const active = teachers.filter((t) => t.is_active !== false).length;

  const totalElement = document.getElementById('totalTeachers');
  const activeElement = document.getElementById('activeTeachers');

  if (totalElement) totalElement.textContent = `${total}명`;
  if (activeElement) activeElement.textContent = `${active}명`;
}

// ==================== 선생님 등록 모달 표시 ====================
function showAddTeacherModal() {
  console.log('선생님 등록 모달 열기');

  // 모달 제목을 "선생님 등록"으로 설정
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    modalTitle.textContent = '선생님 등록';
  } else {
    // h2 태그를 직접 찾아서 변경 (폴백)
    const h2 = document.querySelector('#addTeacherModal .modal-header h2');
    if (h2) h2.textContent = '선생님 등록';
  }

  const modal = document.getElementById('addTeacherModal');
  if (modal) modal.classList.add('active');

  // 폼 초기화
  resetForm();

  // 아이디 필드 활성화
  const teacherId = document.getElementById('teacherId');
  if (teacherId) {
    teacherId.disabled = false;
  }

  // 비밀번호 placeholder 원래대로
  const teacherPassword = document.getElementById('teacherPassword');
  if (teacherPassword) {
    teacherPassword.placeholder = '비밀번호 입력';
  }

  // 버튼 텍스트와 이벤트 설정
  const saveBtn = document.querySelector('.modal-footer .btn-primary');
  if (saveBtn) {
    saveBtn.textContent = '등록';
    saveBtn.onclick = registerTeacher;
  }

  // 비밀번호 자동생성
  generatePassword();

  currentEditId = null;
}

// ==================== 선생님 수정 모달 ====================
function editTeacher(userId) {
  console.log('수정 버튼 클릭:', userId);

  const teacher = teachers.find((t) => t.user_id === userId);
  if (!teacher) {
    console.error('선생님을 찾을 수 없습니다:', userId);
    return;
  }

  // 모달 제목을 "선생님 정보 수정"으로 변경
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) {
    modalTitle.textContent = '선생님 정보 수정';
  } else {
    // h2 태그를 직접 찾아서 변경 (폴백)
    const h2 = document.querySelector('#addTeacherModal .modal-header h2');
    if (h2) h2.textContent = '선생님 정보 수정';
  }

  // 모달 열기
  const modal = document.getElementById('addTeacherModal');
  if (modal) modal.classList.add('active');

  // 폼에 데이터 채우기
  document.getElementById('teacherName').value = teacher.name || '';
  document.getElementById('teacherId').value = teacher.login_id || '';
  document.getElementById('teacherId').disabled = true; // 아이디는 수정 불가
  document.getElementById('teacherPassword').value = ''; // 비밀번호는 비움
  document.getElementById('teacherPassword').placeholder = '변경시에만 입력';
  document.getElementById('teacherRole').value = teacher.role || 'teacher';
  document.getElementById('teacherPhone').value = teacher.phone || '';

  // 수정 모드로 변경
  currentEditId = userId;

  // 저장 버튼 텍스트와 이벤트 변경
  const saveBtn = document.querySelector('.modal-footer .btn-primary');
  if (saveBtn) {
    saveBtn.textContent = '수정 완료';
    saveBtn.onclick = () => updateTeacher(userId);
  }
}

// ==================== 비밀번호 변경 모달 ====================
function showPasswordModal(userId) {
  const teacher = teachers.find((t) => t.user_id === userId);
  if (!teacher) return;

  // 간단한 프롬프트로 비밀번호 입력받기
  const newPassword = prompt(
    `${teacher.name} 선생님의 새 비밀번호를 입력하세요.\n` +
      `(최소 4자 이상, 빈 칸으로 두면 취소됩니다)`
  );

  if (newPassword === null || newPassword.trim() === '') {
    return; // 취소
  }

  if (newPassword.trim().length < 4) {
    alert('비밀번호는 최소 4자 이상이어야 합니다.');
    return;
  }

  resetPasswordWithValue(userId, newPassword.trim());
}

// ==================== 모달 닫기 ====================
function closeModal() {
  console.log('모달 닫기');

  const modal = document.getElementById('addTeacherModal');
  if (modal) modal.classList.remove('active');

  resetForm();

  // 아이디 필드 활성화
  const teacherId = document.getElementById('teacherId');
  if (teacherId) teacherId.disabled = false;

  // placeholder 원래대로
  const teacherPassword = document.getElementById('teacherPassword');
  if (teacherPassword) teacherPassword.placeholder = '비밀번호 입력';

  // 저장 버튼 원래대로 복구
  const saveBtn = document.querySelector('.modal-footer .btn-primary');
  if (saveBtn) {
    saveBtn.textContent = '등록';
    saveBtn.onclick = registerTeacher;
  }

  currentEditId = null;
}

// ==================== 폼 초기화 ====================
function resetForm() {
  const elements = {
    teacherName: document.getElementById('teacherName'),
    teacherId: document.getElementById('teacherId'),
    teacherPassword: document.getElementById('teacherPassword'),
    teacherRole: document.getElementById('teacherRole'),
    teacherPhone: document.getElementById('teacherPhone'),
  };

  if (elements.teacherName) elements.teacherName.value = '';
  if (elements.teacherId) elements.teacherId.value = '';
  if (elements.teacherPassword) elements.teacherPassword.value = '';
  if (elements.teacherRole) elements.teacherRole.value = 'teacher';
  if (elements.teacherPhone) elements.teacherPhone.value = '';

  currentEditId = null;
}

// ==================== 비밀번호 자동생성 ====================
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const passwordField = document.getElementById('teacherPassword');
  if (passwordField) passwordField.value = password;
}

// ==================== 선생님 등록 ====================
async function registerTeacher() {
  const name = document.getElementById('teacherName').value.trim();
  const loginId = document.getElementById('teacherId').value.trim();
  const password = document.getElementById('teacherPassword').value.trim();
  const role = document.getElementById('teacherRole').value;
  const phone = document.getElementById('teacherPhone').value.trim();

  // 유효성 검사
  if (!name || !loginId || !password) {
    alert('필수 정보를 모두 입력해주세요.');
    return;
  }

  // 아이디 형식 검사
  if (!/^[a-zA-Z0-9_]+$/.test(loginId)) {
    alert('아이디는 영문, 숫자, 언더스코어(_)만 사용 가능합니다.');
    return;
  }

  try {
    // 아이디 중복 체크
    const { data: existing } = await supabase
      .from('users')
      .select('login_id')
      .eq('login_id', loginId)
      .maybeSingle();

    if (existing) {
      alert('이미 사용 중인 아이디입니다.');
      return;
    }

    // 새 선생님 등록
    const userId = 'USR' + Date.now();
    const teacherData = {
      user_id: userId,
      login_id: loginId,
      password: password,
      name: name,
      role: role,
      phone: phone || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('users')
      .insert([teacherData])
      .select();

    if (error) {
      console.error('등록 오류:', error);
      throw error;
    }

    alert(
      `✅ 선생님이 등록되었습니다!\n\n` +
        `이름: ${name}\n` +
        `아이디: ${loginId}\n` +
        `비밀번호: ${password}\n` +
        `권한: ${role === 'principal' ? '원장' : '선생님'}`
    );

    // 모달 닫고 목록 새로고침
    closeModal();
    await loadTeachers();
    updateStatistics();
  } catch (error) {
    console.error('선생님 등록 실패:', error);
    alert('등록 중 오류가 발생했습니다.\n' + (error.message || ''));
  }
}

// ==================== 선생님 정보 업데이트 ====================
async function updateTeacher(userId) {
  console.log('선생님 정보 업데이트:', userId);

  const name = document.getElementById('teacherName').value.trim();
  const password = document.getElementById('teacherPassword').value.trim();
  const role = document.getElementById('teacherRole').value;
  const phone = document.getElementById('teacherPhone').value.trim();

  if (!name) {
    alert('이름은 필수입니다.');
    return;
  }

  try {
    const updateData = {
      name: name,
      role: role,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    };

    // 비밀번호가 입력된 경우만 업데이트
    if (password) {
      if (password.length < 4) {
        alert('비밀번호는 최소 4자 이상이어야 합니다.');
        return;
      }
      updateData.password = password;
    }

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', userId);

    if (error) throw error;

    alert('✅ 선생님 정보가 수정되었습니다.');
    closeModal();
    await loadTeachers();
    updateStatistics();
  } catch (error) {
    console.error('수정 실패:', error);
    alert('수정 중 오류가 발생했습니다.\n' + error.message);
  }
}

// ==================== 비밀번호 직접 변경 ====================
async function resetPasswordWithValue(userId, newPassword) {
  const teacher = teachers.find((t) => t.user_id === userId);

  try {
    const { error } = await supabase
      .from('users')
      .update({
        password: newPassword,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;

    alert(
      `✅ 비밀번호가 변경되었습니다.\n\n` +
        `선생님: ${teacher.name}\n` +
        `새 비밀번호: ${newPassword}`
    );
  } catch (error) {
    console.error('비밀번호 변경 실패:', error);
    alert('비밀번호 변경 중 오류가 발생했습니다.');
  }
}

// ==================== 상태 토글 ====================
async function toggleStatus(userId) {
  const teacher = teachers.find((t) => t.user_id === userId);
  if (!teacher) return;

  const newStatus = teacher.is_active === false;
  const action = newStatus ? '활성화' : '비활성화';

  if (!confirm(`${teacher.name} 선생님을 ${action}하시겠습니까?`)) return;

  try {
    const { error } = await supabase
      .from('users')
      .update({
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;

    alert(`${teacher.name} 선생님이 ${action}되었습니다.`);
    await loadTeachers();
    updateStatistics();
  } catch (error) {
    console.error('상태 변경 실패:', error);
    alert('상태 변경 중 오류가 발생했습니다.');
  }
}

// ==================== 날짜 포맷 ====================
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR');
}

// ==================== 로그아웃 ====================
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}

// ==================== ESC 키로 모달 닫기 ====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('addTeacherModal');
    if (modal && modal.classList.contains('active')) {
      closeModal();
    }
  }
});

// ==================== 모달 외부 클릭 시 닫기 ====================
window.addEventListener('load', () => {
  const modal = document.getElementById('addTeacherModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
});
