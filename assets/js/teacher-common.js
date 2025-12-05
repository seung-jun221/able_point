// teacher-common.js - 선생님 페이지 공통 기능

// 🔒 서버에서 역할 검증 (보안 강화)
async function verifyTeacherAccess() {
  try {
    const loginId = localStorage.getItem('loginId');

    if (!loginId) {
      return { success: false, error: '로그인이 필요합니다.' };
    }

    // DB에서 실제 역할 조회
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, role, name, is_active')
      .eq('login_id', loginId)
      .single();

    if (error || !user) {
      return { success: false, error: '사용자를 찾을 수 없습니다.' };
    }

    if (!user.is_active) {
      return { success: false, error: '비활성화된 계정입니다.' };
    }

    // teacher 또는 principal만 접근 허용
    if (!['teacher', 'principal'].includes(user.role)) {
      return { success: false, error: '접근 권한이 없습니다.', role: user.role };
    }

    return {
      success: true,
      role: user.role,
      name: user.name,
      userId: user.user_id
    };
  } catch (error) {
    console.error('권한 검증 오류:', error);
    return { success: false, error: '권한 확인 중 오류가 발생했습니다.' };
  }
}

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async () => {
  // 🔒 서버에서 역할 검증 (가장 먼저 실행)
  const accessCheck = await verifyTeacherAccess();

  if (!accessCheck.success) {
    console.error('접근 거부:', accessCheck.error);
    alert(accessCheck.error || '이 페이지에 접근할 권한이 없습니다.');

    // 학생이면 학생 페이지로, 아니면 로그인 페이지로
    if (accessCheck.role === 'student') {
      window.location.href = '../student/index.html';
    } else if (accessCheck.role === 'parent') {
      window.location.href = '../parent/index.html';
    } else {
      localStorage.clear();
      window.location.href = '../login.html';
    }
    return;
  }

  console.log('✅ 접근 허용:', accessCheck.role, accessCheck.name);

  // 로그인 체크
  const userId = localStorage.getItem('userId');
  const userRole = accessCheck.role; // 서버에서 받은 역할 사용
  const userName = accessCheck.name || localStorage.getItem('userName');
  const loginId = localStorage.getItem('loginId');

  // 사용자 정보 표시
  if (document.getElementById('teacherName')) {
    document.getElementById('teacherName').textContent = userName || '선생님';
  }
  if (document.getElementById('userRole')) {
    document.getElementById('userRole').textContent =
      userRole === 'principal' ? '원장' : '선생님';
  }

  // 원장 권한 체크 - 서버에서 받은 역할로 확인
  const adminSection = document.getElementById('adminSection');
  if (adminSection) {
    if (userRole === 'principal') {
      console.log('관리자 메뉴 표시');
      adminSection.style.display = 'block';
    } else {
      console.log('관리자 메뉴 숨김');
      adminSection.style.display = 'none';
    }
  }

  // 반 목록 로드
  await loadClassList();

  // 저장된 반 선택 복원
  const savedClassId = localStorage.getItem('selectedClassId');
  if (savedClassId && document.getElementById('classSelector')) {
    document.getElementById('classSelector').value = savedClassId;
  }

  // 반 선택 이벤트
  const classSelector = document.getElementById('classSelector');
  if (classSelector) {
    classSelector.addEventListener('change', (e) => {
      const classId = e.target.value;
      localStorage.setItem('selectedClassId', classId);

      // 페이지별 콜백 실행 (각 페이지에서 정의)
      if (typeof onClassChange === 'function') {
        onClassChange(classId);
      } else {
        location.reload();
      }
    });
  }

  // 현재 페이지 메뉴 활성화
  activateCurrentMenu();

  // 미지급 구매 개수 체크
  checkPendingPurchases();

  // 사용하지 않는 메뉴 숨기기
  hideUnusedMenus();
});

// 사용하지 않는 메뉴 숨기기 함수 추가
function hideUnusedMenus() {
  // 방법 1: 리포트 섹션 전체 숨기기
  const reportSections = document.querySelectorAll('.nav-section');
  reportSections.forEach((section) => {
    const title = section.querySelector('.nav-section-title');
    if (title && title.textContent === '리포트') {
      section.style.display = 'none';
    }
  });
}

// 반 목록 동적 로드
async function loadClassList() {
  try {
    const selector = document.getElementById('classSelector');
    if (!selector) return;

    const result = await api.getClassList();

    // 기본 옵션
    selector.innerHTML = '<option value="">전체 반</option>';

    if (result.success) {
      // 초등부
      if (result.data.elementary && result.data.elementary.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '초등부';
        result.data.elementary.forEach((cls) => {
          const option = document.createElement('option');
          option.value = cls.value;
          option.textContent = cls.label;
          optgroup.appendChild(option);
        });
        selector.appendChild(optgroup);
      }

      // 중등부
      if (result.data.middle && result.data.middle.length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = '중등부';
        result.data.middle.forEach((cls) => {
          const option = document.createElement('option');
          option.value = cls.value;
          option.textContent = cls.label;
          optgroup.appendChild(option);
        });
        selector.appendChild(optgroup);
      }
    }
  } catch (error) {
    console.error('반 목록 로드 실패:', error);
  }
}

// 현재 페이지 메뉴 활성화
function activateCurrentMenu() {
  const currentPage = window.location.pathname.split('/').pop();

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');
    const href = item.getAttribute('href');
    if (href === currentPage) {
      item.classList.add('active');
    }
  });
}

// 미지급 구매 개수 확인
async function checkPendingPurchases() {
  try {
    const result = await api.getPendingPurchasesCount();
    if (result.success && result.data.count > 0) {
      const badge = document.getElementById('pendingBadge');
      if (badge) {
        badge.textContent = result.data.count;
        badge.style.display = 'inline-block';
      }
    }
  } catch (error) {
    console.error('미지급 구매 확인 실패:', error);
  }
}

// 공통 로그아웃 함수
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}

// 선택된 반 ID 가져오기
function getSelectedClassId() {
  return localStorage.getItem('selectedClassId') || '';
}
