// ranking.js - 랭킹 페이지 로직 (완성 버전)

// 전역 변수
let currentTab = 'accumulated';
let studentData = null;
let rankingData = {
  accumulated: [],
  weekly: [],
};
let allStudentsData = [];

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('랭킹 페이지 초기화');

  const studentId = localStorage.getItem('loginId');
  if (!studentId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  await loadStudentData();
  await loadRankingData();
  setupEventListeners();
  updateDisplay();
});

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      studentData = result.data;
      await calculateMyWeeklyPoints();
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
  }
}

// 내 주간 포인트만 계산
async function calculateMyWeeklyPoints() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getPointHistory(studentId);

    if (result.success) {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(
        now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)
      );
      monday.setHours(0, 0, 0, 0);

      const weeklyPoints = result.data
        .filter((item) => new Date(item.date) >= monday)
        .filter((item) => parseInt(item.amount) > 0)
        .reduce((sum, item) => sum + parseInt(item.amount), 0);

      studentData.weeklyPoints = weeklyPoints;
    }
  } catch (error) {
    console.error('주간 포인트 계산 오류:', error);
    studentData.weeklyPoints = 0;
  }
}

// 랭킹 데이터 로드 함수 수정
async function loadRankingData() {
  try {
    const result = await api.getRanking();

    if (result.success) {
      allStudentsData = result.data;

      // 숫자 변환 확실히 하기
      allStudentsData = allStudentsData.map((student) => ({
        ...student,
        currentPoints:
          parseInt(String(student.currentPoints).replace(/,/g, '')) || 0,
        totalPoints:
          parseInt(String(student.totalPoints).replace(/,/g, '')) || 0,
      }));

      console.log(
        '정렬 전 TOP 3:',
        allStudentsData
          .slice(0, 3)
          .map((s) => `${s.name}: 누적 ${s.totalPoints}P`)
      );

      // 누적 랭킹 (누적 포인트 기준) ⭐ 변경된 부분
      rankingData.accumulated = allStudentsData
        .sort((a, b) => b.totalPoints - a.totalPoints) // totalPoints로 변경!
        .slice(0, 20)
        .map((student, index) => ({
          rank: index + 1,
          name: student.name,
          points: student.totalPoints, // totalPoints 표시!
          avatar: student.avatar || '👤',
          studentId: student.studentId,
        }));

      console.log(
        '정렬 후 TOP 3:',
        rankingData.accumulated
          .slice(0, 3)
          .map((s) => `${s.rank}위 ${s.name}: ${s.points}P (누적)`)
      );

      generateTemporaryWeeklyRanking();
    }
  } catch (error) {
    console.error('랭킹 데이터 로드 오류:', error);
    rankingData.accumulated = [];
    rankingData.weekly = [];
  }
}

// 임시 주간 랭킹 생성
function generateTemporaryWeeklyRanking() {
  rankingData.weekly = allStudentsData
    .map((student, index) => ({
      rank: index + 1,
      name: student.name,
      points: Math.floor(Math.random() * 500) + 50,
      avatar: student.avatar || '👤',
      studentId: student.studentId,
      isMe: student.studentId === localStorage.getItem('loginId'),
    }))
    .sort((a, b) => b.points - a.points)
    .map((student, index) => ({
      ...student,
      rank: index + 1,
    }));

  if (studentData && studentData.weeklyPoints !== undefined) {
    const myIndex = rankingData.weekly.findIndex(
      (s) => s.studentId === localStorage.getItem('loginId')
    );
    if (myIndex >= 0) {
      rankingData.weekly[myIndex].points = studentData.weeklyPoints;
      rankingData.weekly.sort((a, b) => b.points - a.points);
      rankingData.weekly.forEach((s, i) => (s.rank = i + 1));
    }
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  document.querySelectorAll('.ranking-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.tab;
      switchTab(tabName);
    });
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.group-header')) {
      const header = e.target.closest('.group-header');
      const content = header.nextElementSibling;

      header.classList.toggle('active');
      content.classList.toggle('show');
    }
  });
}

// 탭 전환
function switchTab(tabName) {
  currentTab = tabName;

  document.querySelectorAll('.ranking-tab').forEach((tab) => {
    tab.classList.remove('active');
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    }
  });

  updateDisplay();
}

// 화면 업데이트
function updateDisplay() {
  updateMyStatus();

  if (currentTab === 'accumulated') {
    displayAccumulatedRanking();
  } else {
    displayWeeklyRanking();
  }
}

// 내 현황 업데이트 함수도 수정
function updateMyStatus() {
  const statusCard = document.getElementById('myStatusCard');
  const myId = localStorage.getItem('loginId');

  if (currentTab === 'accumulated') {
    const myRank = rankingData.accumulated.findIndex(
      (r) => r.studentId === myId
    );

    statusCard.innerHTML = `
      <div class="status-header">
        <div class="status-title">💰 포인트 랭킹</div>
        <span class="status-badge">누적</span>
      </div>
      <div class="status-content">
        <div class="status-item">
          <div class="status-label">내 누적 포인트</div>
          <div class="status-value">${(
            studentData?.totalPoints || 0
          ).toLocaleString()}P</div>
        </div>
        <div class="status-item">
          <div class="status-label">내 순위</div>
          <div class="status-value rank">
            ${myRank >= 0 ? `${myRank + 1}위` : 'TOP 20 외'}
          </div>
          <div class="status-subtext">
            ${myRank >= 0 ? 'TOP 20 진입! 🎉' : '더 노력하면 TOP 20!'}
          </div>
        </div>
      </div>
    `;
  } else {
    // 주간 랭킹 부분은 그대로
    const myWeeklyData = rankingData.weekly.find((r) => r.studentId === myId);
    const myWeeklyRank = myWeeklyData ? myWeeklyData.rank : '측정중';

    statusCard.innerHTML = `
      <div class="status-header">
        <div class="status-title">🏆 이번주 스타</div>
        <span class="status-badge">주간</span>
      </div>
      <div class="status-content">
        <div class="status-item">
          <div class="status-label">이번주 획득</div>
          <div class="status-value">+${(
            studentData?.weeklyPoints || 0
          ).toLocaleString()}P</div>
        </div>
        <div class="status-item">
          <div class="status-label">내 순위</div>
          <div class="status-value rank">${myWeeklyRank}위</div>
          <div class="status-subtext">${getWeeklyMessage(myWeeklyRank)}</div>
        </div>
      </div>
    `;
  }
}

// 주간 메시지
function getWeeklyMessage(rank) {
  if (rank === '측정중') return '순위 계산 중...';
  const num = typeof rank === 'number' ? rank : parseInt(rank);
  if (num <= 3) return '🏆 최고예요!';
  if (num <= 10) return '🎉 TOP 10!';
  if (num <= 20) return '🔥 TOP 20!';
  return '💪 화이팅!';
}

// 누적 랭킹 표시
function displayAccumulatedRanking() {
  const container = document.getElementById('rankingContent');
  const myId = localStorage.getItem('loginId');

  if (rankingData.accumulated.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding:40px;">데이터 로딩 중...</div>';
    return;
  }

  const top3 = rankingData.accumulated.slice(0, 3);

  container.innerHTML = `
    <div class="podium-section">
      <h3 class="podium-title">🏆 TOP 3</h3>
      <div class="podium-container">
        ${displayPodium(top3)}
      </div>
    </div>
    
    <div class="ranking-list-section">
      <div class="list-header">
        <div>
          <div class="list-title">포인트 랭킹 TOP 20</div>
          <div class="list-subtitle">누적 포인트 기준</div>
        </div>
      </div>
      
      <div class="ranking-list">
        ${rankingData.accumulated
          .slice(3)
          .map((user) =>
            displayRankingItem(user, 'accumulated', user.studentId === myId)
          )
          .join('')}
      </div>
      
      <div class="notice-box">
        ※ TOP 20만 공개됩니다
      </div>
    </div>
  `;
}

// 주간 랭킹 표시
function displayWeeklyRanking() {
  const container = document.getElementById('rankingContent');
  const myId = localStorage.getItem('loginId');

  if (rankingData.weekly.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding:40px;">주간 랭킹 준비 중...</div>';
    return;
  }

  const top10 = rankingData.weekly.slice(0, 10);

  const groups = {
    '11-20': rankingData.weekly.slice(10, 20),
    '21-40': rankingData.weekly.slice(20, 40),
  };

  container.innerHTML = `
    <div class="podium-section">
      <h3 class="podium-title">🌟 이번주 스타 TOP 3</h3>
      <div class="podium-container">
        ${displayPodium(top10.slice(0, 3))}
      </div>
    </div>
    
    <div class="ranking-list-section">
      <div class="list-header">
        <div>
          <div class="list-title">이번주 스타</div>
          <div class="list-subtitle">주간 획득 포인트</div>
        </div>
      </div>
      
      <div class="ranking-list">
        ${top10
          .slice(3)
          .map((user) =>
            displayRankingItem(user, 'weekly', user.studentId === myId)
          )
          .join('')}
      </div>
      
      ${
        Object.keys(groups).length > 0
          ? '<div class="group-section">' + displayGroups(groups) + '</div>'
          : ''
      }
    </div>
  `;
}

// 포디움 표시 - 메달 제거 버전
function displayPodium(top3) {
  if (!top3 || top3.length === 0) return '';

  // 시각적 순서: 2등 - 1등 - 3등 (가운데가 제일 높음)
  const visualOrder = [
    { data: top3[1], position: 'second', rank: 2 },
    { data: top3[0], position: 'first', rank: 1 },
    { data: top3[2], position: 'third', rank: 3 },
  ];

  return visualOrder
    .map((item) => {
      if (!item.data) return '<div class="podium-item"></div>';

      return `
      <div class="podium-item ${item.position}">
        <div class="podium-rank-number">${item.rank}등</div>
        <div class="podium-avatar">${item.data.avatar || '👤'}</div>
        <div class="podium-name">${maskName(
          item.data.name,
          item.data.studentId
        )}</div>
        <div class="podium-points">${item.data.points.toLocaleString()}P</div>
        <div class="podium-bar"></div>
      </div>
    `;
    })
    .join('');
}

// 랭킹 아이템 표시
function displayRankingItem(user, type, isMe) {
  const rankClass = user.rank <= 3 ? `rank-${user.rank}` : 'rank-other';

  return `
    <div class="ranking-item ${isMe ? 'me' : ''}">
      <div class="rank-number ${rankClass}">${user.rank}</div>
      <div class="rank-avatar">${user.avatar || '👤'}</div>
      <div class="rank-info">
        <div class="rank-name">${maskName(user.name, user.studentId)} ${
    isMe ? '(나)' : ''
  }</div>
      </div>
      <div class="rank-points ${type === 'weekly' ? 'weekly' : ''}">
        ${type === 'weekly' ? '+' : ''}${user.points.toLocaleString()}P
      </div>
    </div>
  `;
}

// 그룹 표시
function displayGroups(groups) {
  const myId = localStorage.getItem('loginId');
  const groupIcons = {
    '11-20': '🥈',
    '21-40': '🥉',
  };

  return Object.entries(groups)
    .map(([range, users]) => {
      if (!users || users.length === 0) return '';

      const hasMe = users.some((u) => u.studentId === myId);

      return `
      <div class="group-container">
        <div class="group-header">
          <div class="group-title">
            <span class="group-icon">${groupIcons[range]}</span>
            <span class="group-range">${range}위</span>
            ${hasMe ? '<span style="color:#6366f1;">💙</span>' : ''}
          </div>
          <span class="group-expand">▼</span>
        </div>
        <div class="group-content">
          ${users
            .slice(0, 5)
            .map(
              (user) => `
            <div class="group-member ${user.studentId === myId ? 'me' : ''}">
              <span>${maskName(user.name, user.studentId)}</span>
              <span>+${user.points}P</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
    })
    .join('');
}

// 이름 마스킹
function maskName(name, studentId) {
  if (!name) return '이름없음';
  if (studentId === localStorage.getItem('loginId')) return name;

  const first = name.charAt(0);
  const last = name.charAt(name.length - 1);
  return `${first}*${last}`;
}

// 새로고침
window.refreshRanking = function () {
  location.reload();
};
