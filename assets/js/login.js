// login.js - 로그인 페이지 기능

// 이모지 애니메이션
const emojis = ['🎓', '📚', '✏️', '🎯', '💡', '🏆', '⭐'];
let emojiIndex = 0;

// 페이지 로드 시
document.addEventListener('DOMContentLoaded', () => {
  // 이모지 로테이션
  setInterval(() => {
    emojiIndex = (emojiIndex + 1) % emojis.length;
    document.getElementById('loginEmoji').textContent = emojis[emojiIndex];
  }, 3000);

  // 저장된 로그인 정보 확인
  const savedId = localStorage.getItem('savedLoginId');
  if (savedId) {
    document.getElementById('loginId').value = savedId;
    document.getElementById('rememberMe').checked = true;
  }

  // 엔터 키 지원
  setupEnterKey();
});

// 로그인 폼 제출
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const loginId = document.getElementById('loginId').value;
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  const errorDiv = document.getElementById('errorMessage');

  // 에러 메시지 초기화
  errorDiv.classList.remove('show');

  // 로딩 표시
  const submitBtn = document.querySelector('.login-btn');
  const originalContent = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="loading"></span> 로그인 중...';
  submitBtn.disabled = true;

  try {
    const result = await api.login(loginId, password);

    if (result.success) {
      // 로그인 정보 저장
      if (rememberMe) {
        localStorage.setItem('savedLoginId', loginId);
      } else {
        localStorage.removeItem('savedLoginId');
      }

      localStorage.setItem('userId', result.data.userId);
      localStorage.setItem('loginId', result.data.loginId);
      localStorage.setItem('userName', result.data.name);
      localStorage.setItem('userRole', result.data.role);

      // 성공 애니메이션
      submitBtn.innerHTML = '✅ 로그인 성공!';
      submitBtn.style.background = 'linear-gradient(135deg, #10b981, #22c55e)';

      // 역할에 따라 리다이렉트
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

      // 버튼 복구
      submitBtn.innerHTML = originalContent;
      submitBtn.disabled = false;
    }
  } catch (error) {
    errorDiv.textContent =
      '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
    errorDiv.classList.add('show');

    // 버튼 복구
    submitBtn.innerHTML = originalContent;
    submitBtn.disabled = false;
  }
});

// 비밀번호 표시/숨기기
function togglePassword() {
  const passwordInput = document.getElementById('password');
  const eyeIcon = document.getElementById('eyeIcon');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeIcon.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    eyeIcon.textContent = '👁️';
  }
}

// 빠른 로그인 (데모용)
function quickLogin(type) {
  if (type === 'student') {
    document.getElementById('loginId').value = 'S001';
    document.getElementById('password').value = '1234';
  } else if (type === 'teacher') {
    document.getElementById('loginId').value = 'T001';
    document.getElementById('password').value = 'teacher123';
  }

  // 자동 제출
  document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}

// 도움말 표시
function showHelp() {
  alert(
    '로그인 도움말\n\n' +
      '학생 로그인:\n' +
      '- 아이디: S로 시작하는 학생번호\n' +
      '- 비밀번호: 4자리 숫자\n\n' +
      '선생님 로그인:\n' +
      '- 아이디: T로 시작하는 교사번호\n' +
      '- 비밀번호: 지정된 비밀번호\n\n' +
      '문의: 063-123-4567'
  );
}

// 엔터 키 지원
function setupEnterKey() {
  const inputs = document.querySelectorAll('.form-input');
  inputs.forEach((input, index) => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        } else {
          document
            .getElementById('loginForm')
            .dispatchEvent(new Event('submit'));
        }
      }
    });
  });
}

// 입력 필드 포커스 효과
document.querySelectorAll('.form-input').forEach((input) => {
  input.addEventListener('focus', () => {
    input.parentElement.style.transform = 'scale(1.02)';
  });

  input.addEventListener('blur', () => {
    input.parentElement.style.transform = 'scale(1)';
  });
});
