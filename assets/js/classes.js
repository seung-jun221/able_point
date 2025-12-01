// classes.js - 클래스 관리 기능 (완전 수정판)

// ==================== 전역 변수 ====================
let classes = [];
let teachers = [];
let currentEditId = null;

// ==================== 페이지 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('클래스 관리 페이지 초기화');

  // 권한 체크
  const loginId = localStorage.getItem('loginId');
  const userRole = localStorage.getItem('userRole');

  if (loginId !== 'ablemaster' && userRole !== 'principal') {
    alert('원장님만 접근 가능합니다.');
    window.location.href = 'index.html';
    return;
  }

  // 데이터 로드
  await loadClasses();
  await loadTeachers();
  updateStatistics();
});

// ==================== 클래스 목록 로드 ====================
async function loadClasses() {
  try {
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .order('class_code');

    if (classError) throw classError;

    // 각 클래스의 학생 수 계산
    const { data: students } = await supabase
      .from('students')
      .select('class_id');

    // 클래스별 학생 수 계산
    classes = (classData || []).map((cls) => {
      const studentCount =
        students?.filter((s) => s.class_id === cls.class_id).length || 0;
      return {
        ...cls,
        student_count: studentCount,
      };
    });

    console.log('로드된 클래스:', classes);
    displayClasses();
  } catch (error) {
    console.error('클래스 목록 로드 실패:', error);
    displayError();
  }
}

// ==================== 선생님 목록 로드 ====================
async function loadTeachers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, name, login_id')
      .in('role', ['teacher', 'principal'])
      .order('name');

    if (error) throw error;

    teachers = data || [];
    updateTeacherSelect();
  } catch (error) {
    console.error('선생님 목록 로드 실패:', error);
  }
}

// ==================== 클래스 카드 표시 ====================
function displayClasses() {
  const grid = document.getElementById('classGrid');

  if (!grid) {
    console.error('classGrid 요소를 찾을 수 없습니다');
    return;
  }

  if (classes.length === 0) {
    grid.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; width: 100%;">
        <div style="font-size: 64px; margin-bottom: 16px;">🏫</div>
        <div style="font-size: 18px; color: #6b7280; margin-bottom: 8px;">등록된 클래스가 없습니다</div>
        <div style="font-size: 14px; color: #9ca3af;">첫 클래스를 생성해보세요</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = classes
    .map((cls) => {
      // 선생님 정보 찾기
      const teacher = teachers.find((t) => t.user_id === cls.teacher_id);

      return `
        <div class="class-card">
          <div class="class-status ${
            cls.status === 'active' ? '' : 'inactive'
          }"></div>
          
          <div class="class-header">
            <div>
              <div class="class-title">${cls.class_name}</div>
              <span class="class-code">${cls.class_code || ''}</span>
            </div>
          </div>
          
          <div class="class-info">
            <div class="info-row">
              <span class="icon">👨‍🏫</span>
              <span>${teacher ? teacher.name : '미배정'}</span>
            </div>
            <div class="info-row">
              <span class="icon">📅</span>
              <span>${getDayText(cls.day_type)}</span>
            </div>
            <div class="info-row">
              <span class="icon">🎯</span>
              <span>정원 ${cls.capacity || 20}명</span>
            </div>
          </div>
          
          <div class="class-stats">
            <div class="stat-item">
              <div class="stat-label">학생</div>
              <div class="stat-value">${cls.student_count || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">학년</div>
              <div class="stat-value">${
                cls.grade === 1
                  ? '초등'
                  : cls.grade === 2
                  ? '중등'
                  : cls.grade === 3
                  ? '고등'
                  : '-'
              }</div>
            </div>
          </div>
          
          <div class="class-actions">
            <button class="btn-class-edit" onclick="editClass('${
              cls.class_id
            }')">
              수정
            </button>
            <button class="btn-class-delete" onclick="deleteClass('${
              cls.class_id
            }')">
              삭제
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

// ==================== 에러 표시 ====================
function displayError() {
  const grid = document.getElementById('classGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; width: 100%;">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 18px; color: #ef4444; margin-bottom: 8px;">데이터 로드 실패</div>
      <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">
        새로고침
      </button>
    </div>
  `;
}

// ==================== 통계 업데이트 ====================
function updateStatistics() {
  const totalClasses = classes.length;
  const totalStudents = classes.reduce(
    (sum, cls) => sum + (cls.student_count || 0),
    0
  );
  const avgStudents =
    totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;

  const totalClassesEl = document.getElementById('totalClasses');
  const totalStudentsEl = document.getElementById('totalStudents');
  const avgStudentsEl = document.getElementById('avgStudents');

  if (totalClassesEl) totalClassesEl.textContent = `${totalClasses}개`;
  if (totalStudentsEl) totalStudentsEl.textContent = `${totalStudents}명`;
  if (avgStudentsEl) avgStudentsEl.textContent = `${avgStudents}명`;
}

// ==================== 선생님 셀렉트 업데이트 ====================
function updateTeacherSelect() {
  const select = document.getElementById('classTeacher');
  if (!select) return;

  select.innerHTML =
    '<option value="">선택</option>' +
    teachers
      .map(
        (t) => `
      <option value="${t.user_id}">${t.name} (${t.login_id})</option>
    `
      )
      .join('');
}

// ==================== 클래스 추가 모달 ====================
function showAddClassModal() {
  console.log('클래스 추가 모달 열기');

  // 모달 제목 설정
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = '클래스 생성';

  // 모달 열기
  const modal = document.getElementById('classModal');
  if (modal) modal.classList.add('active');

  // 폼 초기화
  resetForm();
  currentEditId = null;
}

// ==================== 클래스 수정 ====================
function editClass(classId) {
  console.log('클래스 수정:', classId);

  const cls = classes.find((c) => c.class_id === classId);
  if (!cls) {
    console.error('클래스를 찾을 수 없습니다:', classId);
    return;
  }

  // 모달 제목 변경
  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = '클래스 수정';

  // 모달 열기
  const modal = document.getElementById('classModal');
  if (modal) modal.classList.add('active');

  // 폼에 데이터 채우기
  document.getElementById('className').value = cls.class_name || '';
  document.getElementById('classCode').value = cls.class_code || '';
  document.getElementById('classGrade').value = cls.grade || '';
  document.getElementById('classDay').value = cls.day_type || '';
  document.getElementById('classTeacher').value = cls.teacher_id || '';
  document.getElementById('classCapacity').value = cls.capacity || 20;
  document.getElementById('classStatus').value = cls.status || 'active';

  currentEditId = classId;
}

// ==================== 클래스 저장 ====================
async function saveClass() {
  const className = document.getElementById('className').value.trim();
  const classCode = document.getElementById('classCode').value.trim();
  const grade = document.getElementById('classGrade').value;
  const dayType = document.getElementById('classDay').value;
  const teacherId = document.getElementById('classTeacher').value;
  const capacity = document.getElementById('classCapacity').value;
  const status = document.getElementById('classStatus').value;

  // 유효성 검사
  if (!className) {
    alert('클래스명을 입력해주세요.');
    return;
  }

  if (!classCode) {
    alert('클래스 코드를 입력해주세요.');
    return;
  }

  // 클래스 코드 형식 검사 (예: EM1, EF2, MM1, MF2)
  if (!/^[A-Z]{1,2}[A-Z0-9]{1,3}$/.test(classCode)) {
    alert(
      '클래스 코드 형식이 올바르지 않습니다.\n예: EM1 (초등월수1반), MF2 (중등화목2반)'
    );
    return;
  }

  try {
    const classData = {
      class_name: className,
      class_code: classCode,
      grade: grade ? parseInt(grade) : null,
      day_type: dayType || null,
      teacher_id: teacherId || null,
      capacity: parseInt(capacity) || 20,
      status: status || 'active',
      // updated_at 제거 - 테이블에 해당 컬럼이 없음
    };

    if (currentEditId) {
      // 수정 모드
      const { data, error } = await supabase
        .from('classes')
        .update(classData)
        .eq('class_id', currentEditId)
        .select();

      if (error) throw error;

      alert('✅ 클래스가 수정되었습니다.');
    } else {
      // 신규 생성
      // 중복 체크
      const { data: existing } = await supabase
        .from('classes')
        .select('class_code')
        .eq('class_code', classCode)
        .maybeSingle();

      if (existing) {
        alert('이미 존재하는 클래스 코드입니다.');
        return;
      }

      // 새 클래스 생성 (class_id는 20자 이하로 제한)
      classData.class_id =
        'C' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

      const { data, error } = await supabase
        .from('classes')
        .insert([classData])
        .select();

      if (error) throw error;

      alert('✅ 클래스가 생성되었습니다.');
    }

    // 모달 닫고 목록 새로고침
    closeModal();
    await loadClasses();
    updateStatistics();
  } catch (error) {
    console.error('클래스 저장 실패:', error);

    if (error.code === '23505') {
      alert('이미 존재하는 클래스입니다.');
    } else if (error.code === '23503') {
      alert('선택한 선생님이 존재하지 않습니다.');
    } else {
      alert('저장 중 오류가 발생했습니다.\n' + (error.message || ''));
    }
  }
}

// ==================== 클래스 삭제 ====================
async function deleteClass(classId) {
  const cls = classes.find((c) => c.class_id === classId);
  if (!cls) return;

  // 학생이 있는지 확인
  if (cls.student_count && cls.student_count > 0) {
    alert(
      `이 클래스에는 ${cls.student_count}명의 학생이 있습니다.\n학생을 먼저 다른 클래스로 이동시켜주세요.`
    );
    return;
  }

  if (!confirm(`정말 '${cls.class_name}' 클래스를 삭제하시겠습니까?`)) {
    return;
  }

  try {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('class_id', classId);

    if (error) throw error;

    alert('✅ 클래스가 삭제되었습니다.');
    await loadClasses();
    updateStatistics();
  } catch (error) {
    console.error('클래스 삭제 실패:', error);

    if (error.code === '23503') {
      alert('이 클래스를 참조하는 데이터가 있어 삭제할 수 없습니다.');
    } else {
      alert('삭제 중 오류가 발생했습니다.');
    }
  }
}

// ==================== 모달 닫기 ====================
function closeModal() {
  console.log('모달 닫기');

  const modal = document.getElementById('classModal');
  if (modal) modal.classList.remove('active');

  resetForm();
  currentEditId = null;
}

// ==================== 폼 초기화 ====================
function resetForm() {
  const elements = {
    className: document.getElementById('className'),
    classCode: document.getElementById('classCode'),
    classGrade: document.getElementById('classGrade'),
    classDay: document.getElementById('classDay'),
    classTeacher: document.getElementById('classTeacher'),
    classCapacity: document.getElementById('classCapacity'),
    classStatus: document.getElementById('classStatus'),
  };

  if (elements.className) elements.className.value = '';
  if (elements.classCode) elements.classCode.value = '';
  if (elements.classGrade) elements.classGrade.value = '';
  if (elements.classDay) elements.classDay.value = '';
  if (elements.classTeacher) elements.classTeacher.value = '';
  if (elements.classCapacity) elements.classCapacity.value = '20';
  if (elements.classStatus) elements.classStatus.value = 'active';
}

// ==================== 유틸리티 함수 ====================
function getDayText(dayType) {
  const days = {
    'mon-wed': '월수',
    'tue-thu': '화목',
    'mon-wed-fri': '월수금',
    'tue-thu-sat': '화목토',
    everyday: '매일',
  };
  return days[dayType] || dayType || '-';
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
    const modal = document.getElementById('classModal');
    if (modal && modal.classList.contains('active')) {
      closeModal();
    }
  }
});

// ==================== 모달 외부 클릭 시 닫기 ====================
window.addEventListener('load', () => {
  const modal = document.getElementById('classModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
});
