// ==================== 클래스 관리 기능 ====================

let classes = [];
let teachers = [];
let currentEditId = null;

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('클래스 관리 페이지 초기화');

  const loginId = localStorage.getItem('loginId');
  const userRole = localStorage.getItem('userRole');

  if (loginId !== 'ablemaster' && userRole !== 'principal') {
    alert('원장님만 접근 가능합니다.');
    window.location.href = 'index.html';
    return;
  }

  // 병렬 로드
  await Promise.all([loadClasses(), loadTeachers()]);

  updateStatistics();
});

// 클래스 목록 로드 - 최적화
async function loadClasses() {
  try {
    showLoading();

    // 클래스와 학생 수를 한 번에 가져오기
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .order('class_code');

    if (classError) throw classError;

    // 학생 수 한 번에 가져오기
    const { data: studentCounts } = await supabase
      .from('student_details')
      .select('class_id');

    // 선생님 정보 한 번에 가져오기
    const teacherIds = [
      ...new Set(
        classData.filter((c) => c.teacher_id).map((c) => c.teacher_id)
      ),
    ];
    const { data: teachersData } = await supabase
      .from('users')
      .select('user_id, name, login_id')
      .in('user_id', teacherIds);

    // 데이터 병합
    classes = classData.map((cls) => {
      const studentCount =
        studentCounts?.filter((s) => s.class_id === cls.class_id).length || 0;
      const teacher = teachersData?.find((t) => t.user_id === cls.teacher_id);

      return {
        ...cls,
        student_count: cls.student_count || studentCount,
        teacher: teacher,
      };
    });

    displayClasses();
    updateStatistics();
  } catch (error) {
    console.error('클래스 목록 로드 실패:', error);
    displayError();
  }
}

// 선생님 목록 로드
async function loadTeachers() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, name, login_id')
      .eq('role', 'teacher')
      .order('name');

    if (error) throw error;

    teachers = data || [];
    updateTeacherSelect();
  } catch (error) {
    console.error('선생님 목록 로드 실패:', error);
  }
}

// 로딩 표시
function showLoading() {
  const grid = document.getElementById('classGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; width: 100%;">
      <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
      <div>데이터 로딩 중...</div>
    </div>
  `;
}

// 에러 표시
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

// 클래스 표시
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
    .map(
      (cls) => `
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
          <span>${cls.teacher?.name || '미배정'}</span>
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
            cls.grade === 1 ? '초등' : cls.grade === 2 ? '중등' : '-'
          }</div>
        </div>
      </div>
      
      <div class="class-actions">
        <button class="btn-class-edit" onclick="editClass('${
          cls.class_id
        }')">수정</button>
        <button class="btn-class-delete" onclick="deleteClass('${
          cls.class_id
        }')">삭제</button>
      </div>
    </div>
  `
    )
    .join('');
}

// 통계 업데이트
function updateStatistics() {
  const totalClasses = classes.length;
  const totalStudents = classes.reduce(
    (sum, cls) => sum + (cls.student_count || 0),
    0
  );
  const avgStudents =
    totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;

  document.getElementById('totalClasses').textContent = `${totalClasses}개`;
  document.getElementById('totalStudents').textContent = `${totalStudents}명`;
  document.getElementById('avgStudents').textContent = `${avgStudents}명`;
}

// 선생님 셀렉트 업데이트
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

// 모달 관련 함수들
function showAddClassModal() {
  document.getElementById('modalTitle').textContent = '클래스 생성';
  document.getElementById('classModal').classList.add('active');
  currentEditId = null;
  resetForm();
}

function closeModal() {
  document.getElementById('classModal').classList.remove('active');
  resetForm();
}

function resetForm() {
  document.getElementById('className').value = '';
  document.getElementById('classCode').value = '';
  document.getElementById('classGrade').value = '';
  document.getElementById('classDay').value = '';
  document.getElementById('classTeacher').value = '';
  document.getElementById('classCapacity').value = '20';
  document.getElementById('classStatus').value = 'active';
}

// 클래스 저장
async function saveClass() {
  const className = document.getElementById('className').value;
  const classCode = document.getElementById('classCode').value;
  const grade = document.getElementById('classGrade').value;
  const dayType = document.getElementById('classDay').value;
  const teacherId = document.getElementById('classTeacher').value;
  const capacity = document.getElementById('classCapacity').value;
  const status = document.getElementById('classStatus').value;

  if (!className || !classCode) {
    alert('클래스명과 클래스 코드는 필수입니다.');
    return;
  }

  try {
    const classData = {
      class_name: className,
      class_code: classCode,
      grade: grade ? parseInt(grade) : null,
      day_type: dayType,
      teacher_id: teacherId || null,
      capacity: parseInt(capacity) || 20,
      status: status,
    };

    if (currentEditId) {
      const { error } = await supabase
        .from('classes')
        .update(classData)
        .eq('class_id', currentEditId);

      if (error) throw error;
      alert('클래스가 수정되었습니다.');
    } else {
      classData.class_id = 'CLS' + Date.now();

      const { error } = await supabase.from('classes').insert(classData);

      if (error) throw error;
      alert('클래스가 생성되었습니다.');
    }

    closeModal();
    await loadClasses();
  } catch (error) {
    console.error('클래스 저장 실패:', error);
    alert('저장 중 오류가 발생했습니다.');
  }
}

// 클래스 수정
function editClass(classId) {
  const cls = classes.find((c) => c.class_id === classId);
  if (!cls) return;

  document.getElementById('modalTitle').textContent = '클래스 수정';
  document.getElementById('classModal').classList.add('active');

  document.getElementById('className').value = cls.class_name;
  document.getElementById('classCode').value = cls.class_code || '';
  document.getElementById('classGrade').value = cls.grade || '';
  document.getElementById('classDay').value = cls.day_type || '';
  document.getElementById('classTeacher').value = cls.teacher_id || '';
  document.getElementById('classCapacity').value = cls.capacity || 20;
  document.getElementById('classStatus').value = cls.status || 'active';

  currentEditId = classId;
}

// 클래스 삭제
async function deleteClass(classId) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('class_id', classId);

    if (error) throw error;

    alert('클래스가 삭제되었습니다.');
    await loadClasses();
  } catch (error) {
    console.error('클래스 삭제 실패:', error);
    alert('삭제 중 오류가 발생했습니다.');
  }
}

// 유틸리티
function getDayText(dayType) {
  const days = {
    'mon-wed': '월수',
    'tue-thu': '화목',
    everyday: '매일',
  };
  return days[dayType] || dayType || '-';
}

function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}
