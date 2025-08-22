// assets/js/login.js - 수정된 버전

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const loginId = document.getElementById('loginId').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('errorMessage');

  errorDiv.classList.remove('show');

  const submitBtn = document.querySelector('.login-btn');
  const originalContent = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="loading"></span> 로그인 중...';
  submitBtn.disabled = true;

  try {
    const result = await api.login(loginId, password);

    if (result.success) {
      // ✅ 수정: 명확한 키 구분
      localStorage.setItem('userId', result.data.userId); // U001
      localStorage.setItem('studentId', result.data.studentId); // STU001 (학생인 경우)
      localStorage.setItem('loginId', result.data.loginId); // S001
      localStorage.setItem('userName', result.data.name);
      localStorage.setItem('userRole', result.data.role);

      // 추가 정보 저장
      if (result.data.avatar) {
        localStorage.setItem('userAvatar', result.data.avatar);
      }
      if (result.data.classId) {
        localStorage.setItem('classId', result.data.classId);
      }

      // 기억하기 처리
      //if (rememberMe) {
      //  localStorage.setItem('savedLoginId', loginId);
      //} else {
      //  localStorage.removeItem('savedLoginId');
      //}

      submitBtn.innerHTML = '✅ 로그인 성공!';
      submitBtn.style.background = 'linear-gradient(135deg, #10b981, #22c55e)';

      // 역할별 리다이렉트
      setTimeout(() => {
        if (result.data.role === 'student') {
          window.location.href = 'student/index.html';
        } else if (result.data.role === 'teacher') {
          window.location.href = 'teacher/index.html';
        } else if (result.data.role === 'parent') {
          window.location.href = 'parent/index.html';
        }
      }, 500);
    } else {
      errorDiv.textContent =
        result.error || '아이디 또는 비밀번호가 올바르지 않습니다.';
      errorDiv.classList.add('show');
      submitBtn.innerHTML = originalContent;
      submitBtn.disabled = false;
    }
  } catch (error) {
    errorDiv.textContent =
      '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
    errorDiv.classList.add('show');
    submitBtn.innerHTML = originalContent;
    submitBtn.disabled = false;
  }
});
