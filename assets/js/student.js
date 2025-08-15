// student.js - 학생 페이지 기능

// 전역 변수
const studentId = localStorage.getItem('loginId');
const userName = localStorage.getItem('userName');
let studentData = null;
let allStudents = [];

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  // 로그인 체크
  if (!studentId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 사용자 이름 표시
  document.getElementById('userName').textContent = userName + ' 님';

  // 데이터 로드
  await loadStudentData();
  await loadRanking();
  await loadStudentsList();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 이벤트 카운트다운 시작
  startEventCountdown();
});

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      studentData = result.data;

      // 포인트 표시
      document.getElementById('totalPoints').textContent =
        studentData.currentPoints + 'P';
      document.getElementById('savingsAmount').textContent =
        studentData.savingsPoints + 'P';
      document.getElementById('totalEarned').textContent =
        studentData.totalPoints + 'P';

      const totalSpent =
        studentData.totalPoints -
        studentData.currentPoints -
        studentData.savingsPoints;
      document.getElementById('totalSpent').textContent =
        Math.max(0, totalSpent) + 'P';

      // 레벨 표시
      document.getElementById('userLevel').textContent = studentData.level;

      // 아바타 표시
      if (studentData.avatar) {
        document.getElementById('userAvatar').textContent = studentData.avatar;
      }

      // 예상 이자 계산
      const expectedInterest = Math.floor(studentData.savingsPoints * 0.02);
      document.getElementById('expectedInterest').textContent =
        expectedInterest;

      // 활동 내역 표시
      loadActivityHistory();
    }
  } catch (error) {
    console.error('데이터 로드 오류:', error);
  }
}

// 활동 내역 로드
async function loadActivityHistory() {
  const activityList = document.getElementById('activityList');

  // 임시 데이터 (실제로는 API에서 가져옴)
  const activities = [
    { type: 'earn', title: '출석 보상', amount: 10, time: '오늘 09:00' },
    { type: 'earn', title: '숙제 완료', amount: 30, time: '어제 17:00' },
    { type: 'save', title: '저축 입금', amount: -500, time: '3일 전' },
    { type: 'spend', title: '연필세트 구매', amount: -100, time: '5일 전' },
  ];

  activityList.innerHTML = activities
    .map((activity) => {
      const iconClass =
        activity.type === 'earn'
          ? 'icon-earn'
          : activity.type === 'save'
          ? 'icon-save'
          : 'icon-spend';
      const icon =
        activity.type === 'earn'
          ? '✅'
          : activity.type === 'save'
          ? '💎'
          : '🛍️';
      const pointsClass =
        activity.amount > 0 ? 'points-positive' : 'points-negative';
      const amountText =
        activity.amount > 0 ? `+${activity.amount}P` : `${activity.amount}P`;

      return `
            <div class="activity-item">
                <div class="activity-left">
                    <div class="activity-icon ${iconClass}">${icon}</div>
                    <div class="activity-info">
                        <span class="activity-title">${activity.title}</span>
                        <span class="activity-time">${activity.time}</span>
                    </div>
                </div>
                <span class="activity-points ${pointsClass}">${amountText}</span>
            </div>
        `;
    })
    .join('');
}

// 랭킹 로드
async function loadRanking() {
  try {
    const result = await api.getRanking();

    if (result.success) {
      const rankingList = document.getElementById('rankingList');
      const top5 = result.data.slice(0, 5);

      rankingList.innerHTML = top5
        .map((student, index) => {
          const rankClass =
            index === 0
              ? 'rank-1'
              : index === 1
              ? 'rank-2'
              : index === 2
              ? 'rank-3'
              : 'rank-other';
          const isMe = student.studentId === studentId;

          return `
                    <div class="rank-item ${isMe ? 'me' : ''}">
                        <span class="rank-number ${rankClass}">${
            index + 1
          }</span>
                        <div class="rank-info">
                            <div class="rank-name">${student.name} ${
            isMe ? '(나)' : ''
          }</div>
                            <div class="rank-points">${
                              student.currentPoints
                            }P</div>
                        </div>
                    </div>
                `;
        })
        .join('');
    }
  } catch (error) {
    console.error('랭킹 로드 오류:', error);
  }
}

// 학생 목록 로드 (친구 선물용)
async function loadStudentsList() {
  try {
    const result = await api.getStudents();

    if (result.success) {
      allStudents = result.data.filter((s) => s.studentId !== studentId);

      // 친구 선택 옵션 업데이트
      const select = document.getElementById('recipientSelect');
      select.innerHTML = '<option value="">친구를 선택하세요</option>';

      allStudents.forEach((student) => {
        select.innerHTML += `
                    <option value="${student.studentId}">
                        ${student.name} (${student.classId})
                    </option>
                `;
      });
    }
  } catch (error) {
    console.error('학생 목록 로드 오류:', error);
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document
        .querySelectorAll('.tab-btn')
        .forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');

      const tab = e.target.dataset.tab;
      filterActivities(tab);
    });
  });

  // 네비게이션
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', function () {
      if (this.dataset.page === 'home') {
        document
          .querySelectorAll('.nav-item')
          .forEach((nav) => nav.classList.remove('active'));
        this.classList.add('active');
      }
    });
  });
}

// 저축하기
async function deposit() {
  const maxAmount = studentData.currentPoints;
  const amount = prompt(`저축할 포인트를 입력하세요 (보유: ${maxAmount}P):`);

  if (amount && !isNaN(amount)) {
    const depositAmount = parseInt(amount);

    if (depositAmount <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }

    if (depositAmount > maxAmount) {
      alert('보유 포인트가 부족합니다.');
      return;
    }

    try {
      const result = await api.deposit(studentId, depositAmount);

      if (result.success) {
        alert(
          `${depositAmount}P를 저축했습니다!\n매주 2% 이자를 받을 수 있어요!`
        );
        loadStudentData();
      } else {
        alert(result.error || '저축에 실패했습니다.');
      }
    } catch (error) {
      console.error('저축 오류:', error);
      alert('저축 중 오류가 발생했습니다.');
    }
  }
}

// 출금하기
async function withdraw() {
  const maxAmount = studentData.savingsPoints;
  const amount = prompt(`출금할 포인트를 입력하세요 (저축: ${maxAmount}P):`);

  if (amount && !isNaN(amount)) {
    const withdrawAmount = parseInt(amount);

    if (withdrawAmount <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }

    if (withdrawAmount > maxAmount) {
      alert('저축 포인트가 부족합니다.');
      return;
    }

    try {
      const result = await api.withdraw(studentId, withdrawAmount);

      if (result.success) {
        alert(`${withdrawAmount}P를 출금했습니다!`);
        loadStudentData();
      } else {
        alert(result.error || '출금에 실패했습니다.');
      }
    } catch (error) {
      console.error('출금 오류:', error);
      alert('출금 중 오류가 발생했습니다.');
    }
  }
}

// 친구 선물
function showGift() {
  document.getElementById('modalTitle').textContent =
    '친구에게 포인트 선물하기';
  document.getElementById('availablePoints').textContent =
    studentData.currentPoints;
  document.getElementById('transferModal').classList.add('active');
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
    // 실제로는 API 호출
    alert(
      `선물이 전송되었습니다!\n기부천사 포인트 ${Math.floor(
        amount * 0.1
      )}P를 추가로 받았어요!`
    );
    closeModal();
    loadStudentData();
  }
}

// 기부하기
function showDonate() {
  const options = [
    '1. 학원 발전 기부 (학원 시설 개선)',
    '2. 친구 도움 기부 (어려운 친구 돕기)',
    '3. 자선 단체 기부 (실제 기부 연계)',
  ].join('\n');

  const choice = prompt(
    `기부 종류를 선택하세요:\n\n${options}\n\n번호를 입력하세요:`
  );

  if (choice) {
    const amount = prompt('기부할 포인트를 입력하세요:');
    if (amount && !isNaN(amount)) {
      alert(
        `${amount}P를 기부했습니다!\n기부천사 명예 포인트 ${Math.floor(
          amount * 0.1
        )}P를 받았어요!`
      );
    }
  }
}

// 마일스톤 보기
function showMilestone() {
  const currentTotal = studentData.totalPoints;
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
  alert(
    `📱 내 정보\n\n이름: ${userName}\n학번: ${studentId}\n레벨: ${studentData.level}\n누적 포인트: ${studentData.totalPoints}P`
  );
}

// 활동 내역 필터링
function filterActivities(tab) {
  // 실제로는 활동 내역을 필터링해서 표시
  console.log('필터:', tab);
}

// 모달 닫기
function closeModal() {
  document.getElementById('transferModal').classList.remove('active');

  // 폼 초기화
  document.getElementById('recipientSelect').value = '';
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferMessage').value = '';
}

// 이벤트 카운트다운
function startEventCountdown() {
  // 매월 마지막 금요일 계산
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 이번 달 마지막 날
  const lastDay = new Date(year, month + 1, 0);
  let lastFriday = new Date(lastDay);

  // 마지막 금요일 찾기
  while (lastFriday.getDay() !== 5) {
    lastFriday.setDate(lastFriday.getDate() - 1);
  }
  lastFriday.setHours(16, 30, 0); // 4:30 PM

  // 이미 지났으면 다음 달
  if (now > lastFriday) {
    lastFriday = new Date(year, month + 2, 0);
    while (lastFriday.getDay() !== 5) {
      lastFriday.setDate(lastFriday.getDate() - 1);
    }
    lastFriday.setHours(16, 30, 0);
  }

  // 카운트다운 업데이트
  function updateCountdown() {
    const now = new Date();
    const diff = lastFriday - now;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    document.getElementById('eventCountdown').textContent = `D-${days}`;

    const dateStr = lastFriday.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    document.getElementById('eventDate').textContent = dateStr + ' 4:30PM';
  }

  updateCountdown();
  setInterval(updateCountdown, 60000); // 1분마다 업데이트
}

// 전체 내역 보기
function showHistory() {
  alert('전체 포인트 내역 페이지로 이동합니다.');
}

function showAllHistory() {
  alert('전체 활동 내역 페이지로 이동합니다.');
}
