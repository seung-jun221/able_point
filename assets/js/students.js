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
    // saveStudent 함수의 수정(currentEditId가 있을 때) 부분만 교체
    if (currentEditId) {
      // ============= 기존 학생 수정 =============
      // 1. users 테이블 업데이트
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

      if (error) {
        console.error('Users 테이블 업데이트 오류:', error);
        throw error;
      }

      // 2. students 테이블이 있는지 먼저 확인
      const { data: existingStudent } = await supabase
        .from('students')
        .select('student_id, current_points, total_points') // 기존 포인트 정보도 가져옴
        .eq('user_id', currentEditId)
        .maybeSingle();

      // 포인트 값 파싱
      const newPoints = parseInt(initialPoints) || 0;

      if (existingStudent) {
        // 기존 포인트와 새 포인트의 차이 계산
        const oldPoints = existingStudent.current_points || 0;
        const pointDifference = newPoints - oldPoints;

        // students 테이블에 데이터가 있으면 업데이트
        const { error: studentError } = await supabase
          .from('students')
          .update({
            name: name,
            class_id: classId,
            current_points: newPoints, // ✅ 현재 포인트 업데이트
            total_points:
              (existingStudent.total_points || 0) +
              Math.max(0, pointDifference), // ✅ 총 포인트는 증가분만 추가
          })
          .eq('user_id', currentEditId);

        if (studentError) {
          console.error('Students 테이블 업데이트 오류:', studentError);
          alert(
            '학생 정보가 일부만 수정되었습니다.\n(기본 정보는 수정됨, 포인트 수정 실패)'
          );
        } else {
          // 포인트 변경 이력 추가 (선택사항)
          if (pointDifference !== 0) {
            const transactionId =
              'TRX' + Date.now() + Math.random().toString(36).substr(2, 5);

            const { error: pointError } = await supabase.from('points').insert({
              transaction_id: transactionId,
              student_id: existingStudent.student_id,
              amount: pointDifference,
              type: pointDifference > 0 ? 'earn' : 'penalty',
              reason: `관리자 포인트 ${
                pointDifference > 0 ? '추가' : '차감'
              } (${oldPoints}P → ${newPoints}P)`,
              created_at: new Date().toISOString(),
            });

            if (pointError) {
              console.error('포인트 이력 저장 오류:', pointError);
            } else {
              console.log('✅ 포인트 이력 저장 완료');
            }
          }

          alert(
            `학생 정보가 모두 수정되었습니다.\n포인트: ${oldPoints}P → ${newPoints}P`
          );
        }
      } else {
        // students 테이블에 데이터가 없으면 새로 생성
        console.log('Students 테이블에 데이터 없음 - 새로 생성');
        const studentId =
          'STU' + Date.now() + Math.random().toString(36).substr(2, 5);

        const { error: createError } = await supabase.from('students').insert({
          student_id: studentId,
          user_id: currentEditId,
          name: name,
          class_id: classId,
          current_points: newPoints, // ✅ 입력한 포인트로 설정
          total_points: newPoints, // ✅ 총 포인트도 동일하게 설정
          savings_points: 0,
          level: '씨앗',
          avatar: '🦁',
        });

        if (createError) {
          console.error('Students 테이블 생성 오류:', createError);
          alert(
            '학생 정보가 일부만 수정되었습니다.\n(기본 정보는 수정됨, 학생 정보 생성 실패)'
          );
        } else {
          alert(
            `학생 정보가 수정되고 누락된 데이터가 복구되었습니다.\n초기 포인트: ${newPoints}P`
          );
        }
      }
    } else {
      // ============= 신규 등록 =============
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

      // 1. users 테이블에 저장
      const { error: userError } = await supabase.from('users').insert({
        user_id: userId,
        login_id: loginId,
        password: password,
        name: name,
        role: 'student',
        phone: phone,
        parent_phone: parentPhone,
      });

      if (userError) {
        console.error('Users 테이블 저장 오류:', userError);
        alert(`사용자 등록 실패: ${userError.message}`);
        throw userError;
      }

      console.log('✅ Users 테이블 저장 성공');

      // 2. students 테이블에 저장 - 에러 처리 강화!
      const pointValue = parseInt(initialPoints) || 0;

      const studentData = {
        student_id: studentId,
        user_id: userId,
        name: name,
        class_id: classId,
        current_points: pointValue,
        total_points: pointValue,
        savings_points: 0,
        level: '씨앗',
        avatar: '🦁',
      };

      console.log('Students 테이블에 저장할 데이터:', studentData);

      const { data: studentResult, error: studentError } = await supabase
        .from('students')
        .insert(studentData)
        .select(); // 저장된 데이터 반환

      if (studentError) {
        console.error('❌ Students 테이블 저장 실패!');
        console.error('에러 코드:', studentError.code);
        console.error('에러 메시지:', studentError.message);
        console.error('에러 상세:', studentError.details);
        console.error('에러 힌트:', studentError.hint);

        // users 테이블 롤백
        await supabase.from('users').delete().eq('user_id', userId);

        alert(
          `학생 정보 저장 실패!\n\n${studentError.message}\n\n가능한 원인:\n1. students 테이블 RLS 정책\n2. 필수 필드 누락\n3. 데이터 타입 불일치`
        );
        throw studentError;
      }

      console.log('✅ Students 테이블 저장 성공:', studentResult);

      // 3. 초기 포인트가 있으면 points 테이블에 이력 추가
      if (pointValue > 0) {
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
          console.error('Points 테이블 저장 오류 (무시):', pointError);
        } else {
          console.log('✅ Points 테이블 저장 성공');
        }
      }

      alert(
        `✅ 학생이 성공적으로 등록되었습니다!\n\n` +
          `이름: ${name}\n` +
          `아이디: ${loginId}\n` +
          `반: ${classId}\n` +
          `초기 포인트: ${pointValue}P`
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

async function deleteStudent(userId) {
  if (!confirm('정말 삭제하시겠습니까?\n관련된 모든 데이터가 삭제됩니다.'))
    return;

  console.log('삭제 시작 - userId:', userId);

  try {
    // 1. 먼저 users 테이블에서 login_id 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('login_id')
      .eq('user_id', userId)
      .single();

    if (userError) {
      console.error('users 테이블 조회 오류:', userError);
      throw userError;
    }

    const loginId = userData.login_id;
    console.log('찾은 login_id:', loginId);

    // 2. students 테이블에서 student_id 조회
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (studentData) {
      console.log('찾은 student_id:', studentData.student_id);

      // 3. points 테이블 삭제
      const { error: pointsError } = await supabase
        .from('points')
        .delete()
        .eq('student_id', studentData.student_id);

      if (pointsError) {
        console.log('points 삭제 시도 중 오류 (무시):', pointsError.message);
      } else {
        console.log('points 테이블 삭제 완료');
      }

      // 4. transactions 테이블 삭제
      const { error: transError } = await supabase
        .from('transactions')
        .delete()
        .eq('student_id', studentData.student_id);

      if (transError) {
        console.log(
          'transactions 삭제 시도 중 오류 (무시):',
          transError.message
        );
      } else {
        console.log('transactions 테이블 삭제 완료');
      }

      // 5. students 테이블 삭제
      const { error: studentsDeleteError } = await supabase
        .from('students')
        .delete()
        .eq('user_id', userId);

      if (studentsDeleteError) {
        console.error('students 테이블 삭제 오류:', studentsDeleteError);
      } else {
        console.log('students 테이블 삭제 완료');
      }
    } else {
      console.log('students 테이블에 데이터 없음 - 건너뜀');
    }

    // 6. badge_claims 테이블 삭제
    if (loginId) {
      const { error: badgeError } = await supabase
        .from('badge_claims')
        .delete()
        .eq('student_id', loginId);

      if (badgeError) {
        console.log(
          'badge_claims 삭제 시도 중 오류 (무시):',
          badgeError.message
        );
      } else {
        console.log('badge_claims 테이블 삭제 완료');
      }
    }

    // 7. 마지막으로 users 삭제
    console.log('users 테이블 삭제 시도...');
    const { error: usersError } = await supabase
      .from('users')
      .delete()
      .eq('user_id', userId);

    if (usersError) {
      console.error('users 테이블 삭제 오류:', usersError);
      alert(
        `삭제 실패: ${usersError.message}\n\n자세한 내용은 콘솔을 확인하세요.`
      );
      throw usersError;
    }

    console.log('모든 삭제 완료!');

    // ✅ 성공 메시지를 먼저 표시
    alert('학생이 삭제되었습니다.');

    // ✅ 방법 1: 강제로 페이지 새로고침
    window.location.reload();

    // ✅ 방법 2: 만약 페이지 새로고침을 원하지 않으면 아래 코드 사용
    // // 삭제된 학생을 배열에서 직접 제거
    // students = students.filter(s => s.user_id !== userId);
    // // 화면 업데이트
    // displayStudents();
    // updateStatistics();
  } catch (error) {
    console.error('=== 삭제 중 최종 오류 ===');
    console.error('오류 상세:', error);

    if (error.message && error.message.includes('row-level security')) {
      alert('삭제 권한이 없습니다.\nSupabase의 RLS 정책을 확인해주세요.');
    } else if (
      error.message &&
      error.message.includes('violates foreign key')
    ) {
      alert('다른 테이블에서 이 학생을 참조하고 있어 삭제할 수 없습니다.');
    } else {
      alert(
        `삭제 중 오류가 발생했습니다.\n\n${error.message || '알 수 없는 오류'}`
      );
    }
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
