// student-main.js - 학생 메인 페이지 전용 함수

// 탭 전환 함수
function showTab(tabName) {
  // 모든 탭 버튼과 콘텐츠 숨기기
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.remove('active');
  });

  // 선택된 탭 활성화
  const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
  const tabContent = document.getElementById(`${tabName}-content`);

  if (tabBtn) tabBtn.classList.add('active');
  if (tabContent) tabContent.classList.add('active');

  // 탭별 데이터 로드 (필요시)
  loadTabData(tabName);
}

// 탭별 데이터 로드
function loadTabData(tabName) {
  switch (tabName) {
    case 'overview':
      // 전체 요약 데이터
      break;
    case 'earn':
      // 획득 내역 요약
      loadEarnSummary();
      break;
    case 'spend':
      // 사용 내역 요약
      loadSpendSummary();
      break;
    case 'save':
      // 저축 내역 요약
      loadSaveSummary();
      break;
  }
}

// 획득 내역 요약 로드
function loadEarnSummary() {
  // API 호출하여 최근 획득 내역 3개 가져오기
  console.log('획득 내역 로드');
  // 실제 구현 시 API 호출
}

// 사용 내역 요약 로드
function loadSpendSummary() {
  // API 호출하여 최근 사용 내역 3개 가져오기
  console.log('사용 내역 로드');
}

// 저축 내역 요약 로드
function loadSaveSummary() {
  // API 호출하여 최근 저축 내역 3개 가져오기
  console.log('저축 내역 로드');
}

// 거래 내역 페이지로 이동 (필터 적용)
function goToHistory(filter) {
  if (filter === 'all') {
    location.href = 'history.html';
  } else {
    location.href = `history.html?filter=${filter}`;
  }
}

// 전체 내역 보기
function showHistory() {
  location.href = 'history.html';
}

// 전체 활동 보기
function showAllHistory() {
  location.href = 'history.html';
}

// 친구 선물 모달
function showGift() {
  const modal = document.getElementById('transferModal');
  if (modal) {
    modal.classList.add('active');
    // 보유 포인트 업데이트
    const currentPoints = studentData?.currentPoints || 0;
    const availableElement = document.getElementById('availablePoints');
    if (availableElement) {
      availableElement.textContent = currentPoints.toLocaleString();
    }

    // 친구 목록 로드
    loadFriendsList();
  }
}

// 친구 목록 로드
async function loadFriendsList() {
  try {
    const result = await api.getStudents();
    if (result.success) {
      const studentId = localStorage.getItem('loginId');
      const friends = result.data.filter((s) => s.studentId !== studentId);

      const select = document.getElementById('recipientSelect');
      if (select) {
        select.innerHTML = '<option value="">친구를 선택하세요</option>';
        friends.forEach((friend) => {
          select.innerHTML += `
            <option value="${friend.studentId}">
              ${friend.name} (${friend.classId})
            </option>
          `;
        });
      }
    }
  } catch (error) {
    console.error('친구 목록 로드 오류:', error);
  }
}

// 선물 보내기
async function sendGift() {
  const recipientId = document.getElementById('recipientSelect').value;
  const amount = parseInt(document.getElementById('transferAmount').value);
  const message = document.getElementById('transferMessage').value;

  if (!recipientId) {
    alert('받는 친구를 선택해주세요.');
    return;
  }

  if (!amount || amount <= 0) {
    alert('올바른 포인트를 입력해주세요.');
    return;
  }

  if (amount > studentData.currentPoints) {
    alert('보유 포인트가 부족합니다.');
    return;
  }

  if (confirm(`${amount}P를 선물하시겠습니까?`)) {
    try {
      // 실제 API 호출
      const studentId = localStorage.getItem('loginId');
      // const result = await api.transferPoints(studentId, recipientId, amount, message);

      // 성공 시
      const bonusPoints = Math.floor(amount * 0.1);
      alert(
        `선물이 전송되었습니다!\n기부천사 포인트 ${bonusPoints}P를 추가로 받았어요!`
      );

      // 데이터 업데이트
      studentData.currentPoints -= amount;
      studentData.currentPoints += bonusPoints;

      closeModal();

      // 화면 새로고침
      if (typeof loadStudentData === 'function') {
        loadStudentData();
      }
    } catch (error) {
      console.error('선물 전송 오류:', error);
      alert('선물 전송 중 오류가 발생했습니다.');
    }
  }
}

// 기부 모달
function showDonate() {
  const modal = document.getElementById('donateModal');
  if (modal) {
    modal.classList.add('active');
    // 보유 포인트 업데이트
    const currentPoints = studentData?.currentPoints || 0;
    const donatableElement = document.getElementById('donatablePoints');
    if (donatableElement) {
      donatableElement.textContent = currentPoints.toLocaleString();
    }
  }
}

// 기부 확인
async function confirmDonate() {
  const type = document.getElementById('donationType').value;
  const amount = parseInt(document.getElementById('donateAmount').value);

  if (!amount || amount <= 0) {
    alert('기부할 포인트를 입력해주세요.');
    return;
  }

  if (amount > studentData.currentPoints) {
    alert('포인트가 부족합니다.');
    return;
  }

  const typeText = {
    school: '학원 발전',
    friend: '어려운 친구 돕기',
    charity: '자선 단체',
  };

  if (confirm(`${typeText[type]}에 ${amount}P를 기부하시겠습니까?`)) {
    try {
      // 실제 API 호출
      const studentId = localStorage.getItem('loginId');
      // const result = await api.donate(studentId, type, amount);

      const bonusPoints = Math.floor(amount * 0.1);
      alert(
        `기부가 완료되었습니다!\n기부천사 명예 포인트 ${bonusPoints}P를 받았습니다!`
      );

      // 데이터 업데이트
      studentData.currentPoints -= amount;
      studentData.currentPoints += bonusPoints;

      closeDonateModal();

      // 화면 새로고침
      if (typeof loadStudentData === 'function') {
        loadStudentData();
      }
    } catch (error) {
      console.error('기부 오류:', error);
      alert('기부 처리 중 오류가 발생했습니다.');
    }
  }
}

// 마일스톤 보기
function showMilestone() {
  const currentTotal = studentData?.totalPoints || 0;
  const milestones = [
    { level: '🌱 씨앗', points: 0, reward: '기본' },
    { level: '🌿 새싹', points: 1000, reward: '배지' },
    { level: '🌳 나무', points: 3000, reward: '특별 배지' },
    { level: '🌲 큰나무', points: 5000, reward: '보너스 100P' },
    { level: '⭐ 별', points: 10000, reward: '보너스 500P' },
    { level: '💎 다이아몬드', points: 20000, reward: '특별 선물' },
  ];

  let currentLevel = milestones[0];
  let nextLevel = milestones[1];

  for (let i = 0; i < milestones.length; i++) {
    if (currentTotal >= milestones[i].points) {
      currentLevel = milestones[i];
      nextLevel = milestones[i + 1] || null;
    }
  }

  const message = nextLevel
    ? `현재 레벨: ${currentLevel.level}\n` +
      `누적 포인트: ${currentTotal}P\n\n` +
      `다음 레벨: ${nextLevel.level}\n` +
      `필요 포인트: ${nextLevel.points - currentTotal}P\n` +
      `달성 보상: ${nextLevel.reward}`
    : `최고 레벨 달성! ${currentLevel.level}\n누적 포인트: ${currentTotal}P`;

  alert(message);
}

// 프로필 보기
function showProfile() {
  location.href = 'profile.html';
}

// 저축 관련 함수들 (savings.html로 이동)
function deposit() {
  location.href = 'savings.html';
}

function withdraw() {
  location.href = 'savings.html';
}

// 모달 닫기
function closeModal() {
  const modal = document.getElementById('transferModal');
  if (modal) {
    modal.classList.remove('active');

    // 폼 초기화
    document.getElementById('recipientSelect').value = '';
    document.getElementById('transferAmount').value = '';
    document.getElementById('transferMessage').value = '';
  }
}

// 기부 모달 닫기
function closeDonateModal() {
  const modal = document.getElementById('donateModal');
  if (modal) {
    modal.classList.remove('active');

    // 입력 초기화
    document.getElementById('donationType').value = 'school';
    document.getElementById('donateAmount').value = '';
  }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDonateModal();
  }
});

// 모달 외부 클릭 시 닫기
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
});

// student.js와 데이터 공유
window.addEventListener('studentDataLoaded', (event) => {
  studentData = event.detail;
});
