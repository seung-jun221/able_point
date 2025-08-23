// ranking.js - 랭킹 페이지 로직 (실제 주간 데이터 연동 버전)

// 전역 변수
let currentTab = 'accumulated';
let studentData = null;
let rankingData = {
  accumulated: [],
  weekly: [],
};
let allStudentsData = [];
let isLoading = false;

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
  console.log('랭킹 페이지 초기화');

  const studentId = localStorage.getItem('loginId');
  if (!studentId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 로딩 표시
  showLoadingState();

  try {
    await loadStudentData();
    await loadRankingData();
    setupEventListeners();
    updateDisplay();
  } catch (error) {
    console.error('초기화 오류:', error);
    showErrorState();
  } finally {
    hideLoadingState();
  }
});

// 로딩 상태 표시
function showLoadingState() {
  isLoading = true;
  const container = document.getElementById('rankingContent');
  if (container) {
    container.innerHTML = `
      <div class="loading-container" style="text-align: center; padding: 60px 20px;">
        <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
        <p style="color: #64748b;">랭킹을 불러오는 중...</p>
      </div>
    `;
  }

  // 로딩 스피너 CSS 추가
  if (!document.getElementById('loadingSpinnerStyle')) {
    const style = document.createElement('style');
    style.id = 'loadingSpinnerStyle';
    style.textContent = `
      .loading-spinner {
        display: inline-block;
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #6366f1;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

// 로딩 상태 숨기기
function hideLoadingState() {
  isLoading = false;
}

// 에러 상태 표시
function showErrorState() {
  const container = document.getElementById('rankingContent');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="font-size: 48px; margin-bottom: 20px;">😢</div>
        <p style="color: #64748b; margin-bottom: 20px;">랭킹을 불러올 수 없습니다</p>
        <button class="btn btn-primary" onclick="location.reload()" 
                style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer;">
          새로고침
        </button>
      </div>
    `;
  }
}

// 학생 데이터 로드
async function loadStudentData() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      studentData = result.data;

      // 주간 포인트 계산 (실제 데이터 기반)
      await calculateMyWeeklyPoints();

      console.log('학생 데이터 로드 완료:', studentData);
    }
  } catch (error) {
    console.error('학생 데이터 로드 오류:', error);
  }
}

// 내 주간 포인트 계산 (실제 거래 내역 기반)
async function calculateMyWeeklyPoints() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getPointHistory(studentId);

    if (result.success && result.data) {
      // 이번 주 월요일 계산
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);

      // 일요일(0)인 경우 지난 월요일로, 아니면 이번 주 월요일로
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      monday.setDate(now.getDate() - daysToSubtract);
      monday.setHours(0, 0, 0, 0);

      console.log('주간 시작일:', monday.toLocaleDateString());

      // 이번 주 포인트 합계
      const weeklyPoints = result.data
        .filter((item) => {
          const itemDate = new Date(item.date);
          return itemDate >= monday && parseInt(item.amount) > 0;
        })
        .reduce((sum, item) => sum + parseInt(item.amount), 0);

      studentData.weeklyPoints = weeklyPoints;
      console.log('내 주간 포인트:', weeklyPoints);
    } else {
      studentData.weeklyPoints = 0;
    }
  } catch (error) {
    console.error('주간 포인트 계산 오류:', error);
    studentData.weeklyPoints = 0;
  }
}

// 랭킹 데이터 로드 (실제 API 사용)
async function loadRankingData() {
  try {
    console.log('랭킹 데이터 로드 시작');

    // 1. 누적 랭킹 로드
    const accResult = await api.getRanking();
    if (accResult.success && accResult.data) {
      // 전체 학생 데이터 저장
      allStudentsData = accResult.data.map((student) => ({
        ...student,
        currentPoints:
          parseInt(String(student.currentPoints).replace(/,/g, '')) || 0,
        totalPoints:
          parseInt(String(student.totalPoints).replace(/,/g, '')) || 0,
      }));

      // 누적 랭킹 (총 포인트 기준)
      rankingData.accumulated = allStudentsData
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 20)
        .map((student, index) => ({
          rank: index + 1,
          name: student.name,
          points: student.totalPoints,
          avatar: student.avatar || '👤',
          studentId: student.studentId,
        }));

      console.log('누적 랭킹 TOP 3:', rankingData.accumulated.slice(0, 3));
    }

    // 2. 주간 랭킹 로드 (실제 API 사용)
    await loadWeeklyRanking();
  } catch (error) {
    console.error('랭킹 데이터 로드 오류:', error);
    rankingData.accumulated = [];
    rankingData.weekly = [];
  }
}

// 실제 주간 랭킹 로드 (핵심 개선 부분)
async function loadWeeklyRanking() {
  try {
    console.log('주간 랭킹 API 호출');

    // API에서 실제 주간 랭킹 가져오기
    const weeklyResult = await api.getWeeklyRanking();

    if (weeklyResult.success && weeklyResult.data) {
      console.log('주간 랭킹 데이터 수신:', weeklyResult.data.length + '명');

      // 주간 랭킹 데이터 포맷팅
      rankingData.weekly = weeklyResult.data
        .map((student, index) => ({
          rank: student.rank || index + 1,
          name: student.name,
          points: student.weeklyPoints || 0,
          avatar: student.avatar || '👤',
          studentId: student.studentId,
          classId: student.classId,
        }))
        .sort((a, b) => b.points - a.points)
        .map((student, index) => ({
          ...student,
          rank: index + 1,
        }));

      console.log('주간 랭킹 TOP 3:', rankingData.weekly.slice(0, 3));
    } else {
      // API 실패 시 대체 방법: 현재 주의 거래 내역 기반 계산
      console.log('주간 랭킹 API 실패, 대체 계산 실행');
      await calculateWeeklyRankingFallback();
    }

    // 내 주간 순위 업데이트
    updateMyWeeklyRank();
  } catch (error) {
    console.error('주간 랭킹 로드 오류:', error);

    // 오류 시 대체 계산
    await calculateWeeklyRankingFallback();
  }
}

// 주간 랭킹 대체 계산 (API 실패 시)
async function calculateWeeklyRankingFallback() {
  try {
    console.log('주간 랭킹 대체 계산 시작');

    // 이번 주 월요일 계산
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(now.getDate() - daysToSubtract);
    monday.setHours(0, 0, 0, 0);

    // 각 학생의 주간 포인트 계산
    const weeklyCalculations = await Promise.all(
      allStudentsData.slice(0, 20).map(async (student) => {
        try {
          // 각 학생의 거래 내역 조회
          const historyResult = await api.getPointHistory(student.studentId);

          if (historyResult.success && historyResult.data) {
            const weeklyPoints = historyResult.data
              .filter((item) => {
                const itemDate = new Date(item.date);
                return itemDate >= monday && parseInt(item.amount) > 0;
              })
              .reduce((sum, item) => sum + parseInt(item.amount), 0);

            return {
              rank: 0,
              name: student.name,
              points: weeklyPoints,
              avatar: student.avatar || '👤',
              studentId: student.studentId,
              classId: student.classId,
            };
          }

          return {
            rank: 0,
            name: student.name,
            points: 0,
            avatar: student.avatar || '👤',
            studentId: student.studentId,
            classId: student.classId,
          };
        } catch (err) {
          console.error(`학생 ${student.name} 주간 포인트 계산 실패:`, err);
          return {
            rank: 0,
            name: student.name,
            points: 0,
            avatar: student.avatar || '👤',
            studentId: student.studentId,
            classId: student.classId,
          };
        }
      })
    );

    // 정렬 및 순위 부여
    rankingData.weekly = weeklyCalculations
      .sort((a, b) => b.points - a.points)
      .map((student, index) => ({
        ...student,
        rank: index + 1,
      }));

    console.log('대체 계산 완료, 주간 TOP 3:', rankingData.weekly.slice(0, 3));
  } catch (error) {
    console.error('주간 랭킹 대체 계산 오류:', error);

    // 최종 폴백: 임시 데이터
    rankingData.weekly = allStudentsData.slice(0, 20).map((student, index) => ({
      rank: index + 1,
      name: student.name,
      points: Math.floor(Math.random() * 200) + 50,
      avatar: student.avatar || '👤',
      studentId: student.studentId,
      classId: student.classId,
    }));
  }
}

// 내 주간 순위 업데이트
function updateMyWeeklyRank() {
  if (!studentData || studentData.weeklyPoints === undefined) return;

  const myId = localStorage.getItem('loginId');
  const myIndex = rankingData.weekly.findIndex((s) => s.studentId === myId);

  if (myIndex >= 0) {
    // 이미 리스트에 있으면 포인트 업데이트
    rankingData.weekly[myIndex].points = studentData.weeklyPoints;
  } else {
    // 리스트에 없으면 추가
    rankingData.weekly.push({
      rank: 999,
      name: studentData.name,
      points: studentData.weeklyPoints,
      avatar: studentData.avatar || '👤',
      studentId: myId,
      classId: studentData.classId,
    });
  }

  // 재정렬 및 순위 재계산
  rankingData.weekly.sort((a, b) => b.points - a.points);
  rankingData.weekly.forEach((s, i) => (s.rank = i + 1));

  // 20위까지만 유지
  if (rankingData.weekly.length > 20) {
    const myFinalIndex = rankingData.weekly.findIndex(
      (s) => s.studentId === myId
    );
    if (myFinalIndex >= 20) {
      // 내가 20위 밖이면 20위까지만 표시하고 내 순위는 별도 표시
      rankingData.weekly = rankingData.weekly.slice(0, 20);
    }
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 탭 전환
  document.querySelectorAll('.ranking-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.tab;
      switchTab(tabName);
    });
  });

  // 그룹 확장/축소
  document.addEventListener('click', (e) => {
    if (e.target.closest('.group-header')) {
      const header = e.target.closest('.group-header');
      const content = header.nextElementSibling;

      header.classList.toggle('active');
      content.classList.toggle('show');
    }
  });

  // 새로고침 버튼 애니메이션
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
      }, 500);
    });
  }
}

// 탭 전환
function switchTab(tabName) {
  if (isLoading) return;

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

// 내 현황 업데이트
function updateMyStatus() {
  const statusCard = document.getElementById('myStatusCard');
  const myId = localStorage.getItem('loginId');

  if (currentTab === 'accumulated') {
    const myRank = rankingData.accumulated.findIndex(
      (r) => r.studentId === myId
    );
    const totalStudents = allStudentsData.length;

    // 전체 순위 계산 (20위 밖일 수도 있음)
    let actualRank = myRank >= 0 ? myRank + 1 : '20위 밖';
    if (myRank < 0 && studentData) {
      // 20위 밖이면 전체 데이터에서 실제 순위 찾기
      const fullRank = allStudentsData
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .findIndex((s) => s.studentId === myId);
      if (fullRank >= 0) {
        actualRank = fullRank + 1;
      }
    }

    statusCard.innerHTML = `
      <div class="status-header">
        <div class="status-title">
          <span>💰</span>
          <span>포인트 랭킹</span>
        </div>
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
            ${typeof actualRank === 'number' ? `${actualRank}위` : actualRank}
          </div>
          <div class="status-subtext">
            ${
              typeof actualRank === 'number' && actualRank <= 3
                ? '🏆 최상위권!'
                : typeof actualRank === 'number' && actualRank <= 10
                ? '🎉 TOP 10!'
                : typeof actualRank === 'number' && actualRank <= 20
                ? '💪 TOP 20!'
                : '더 노력하면 TOP 20! 💪'
            }
          </div>
        </div>
      </div>
    `;
  } else {
    // 주간 랭킹
    const myWeeklyData = rankingData.weekly.find((r) => r.studentId === myId);
    const myWeeklyRank = myWeeklyData ? myWeeklyData.rank : '측정중';
    const weeklyPoints = studentData?.weeklyPoints || 0;

    statusCard.innerHTML = `
      <div class="status-header">
        <div class="status-title">
          <span>🏆</span>
          <span>이번주 스타</span>
        </div>
        <span class="status-badge">주간</span>
      </div>
      <div class="status-content">
        <div class="status-item">
          <div class="status-label">이번주 획득</div>
          <div class="status-value">+${weeklyPoints.toLocaleString()}P</div>
          <div class="status-subtext" style="font-size: 11px; color: #94a3b8;">
            ${new Date().toLocaleDateString('ko-KR', { weekday: 'long' })} 기준
          </div>
        </div>
        <div class="status-item">
          <div class="status-label">내 순위</div>
          <div class="status-value rank">
            ${myWeeklyRank === '측정중' ? myWeeklyRank : `${myWeeklyRank}위`}
          </div>
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
  if (num === 1) return '🏆 이번주 챔피언!';
  if (num <= 3) return '🥇 이번주 TOP 3!';
  if (num <= 10) return '🎉 이번주 TOP 10!';
  if (num <= 20) return '🔥 이번주 TOP 20!';
  return '💪 다음주엔 더 높이!';
}

// 누적 랭킹 표시
function displayAccumulatedRanking() {
  const container = document.getElementById('rankingContent');
  const myId = localStorage.getItem('loginId');

  if (rankingData.accumulated.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
        <p>랭킹 데이터를 불러오는 중...</p>
      </div>
    `;
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
        ※ TOP 20까지 공개됩니다 • 매일 자정 업데이트
      </div>
    </div>
  `;
}

// 주간 랭킹 표시
function displayWeeklyRanking() {
  const container = document.getElementById('rankingContent');
  const myId = localStorage.getItem('loginId');

  if (rankingData.weekly.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color: #94a3b8;">
        <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
        <p>주간 랭킹을 계산하는 중...</p>
      </div>
    `;
    return;
  }

  const top3 = rankingData.weekly.slice(0, 3);
  const top10 = rankingData.weekly.slice(0, 10);

  // 11-20위 그룹
  const groups = {};
  if (rankingData.weekly.length > 10) {
    groups['11-20'] = rankingData.weekly.slice(10, 20);
  }

  container.innerHTML = `
    <div class="podium-section">
      <h3 class="podium-title">🌟 이번주 스타 TOP 3</h3>
      <div class="podium-container">
        ${displayPodium(top3)}
      </div>
    </div>
    
    <div class="ranking-list-section">
      <div class="list-header">
        <div>
          <div class="list-title">이번주 스타</div>
          <div class="list-subtitle">
            ${getWeekPeriod()}
          </div>
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
      
      <div class="notice-box">
        ※ 매주 월요일 오전 9시 초기화 • 주간 획득 포인트 기준
      </div>
    </div>
  `;
}

// 이번 주 기간 표시
function getWeekPeriod() {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // 이번 주 월요일
  const monday = new Date(now);
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(now.getDate() - daysToSubtract);

  // 이번 주 일요일
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatDate = (date) => {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return `${formatDate(monday)} ~ ${formatDate(sunday)} 주간 획득 포인트`;
}

// 포디움 표시
function displayPodium(top3) {
  if (!top3 || top3.length === 0) return '<div>데이터가 없습니다</div>';

  // 시각적 순서: 2등 - 1등 - 3등
  const visualOrder = [
    { data: top3[1], position: 'second', rank: 2 },
    { data: top3[0], position: 'first', rank: 1 },
    { data: top3[2], position: 'third', rank: 3 },
  ];

  return visualOrder
    .map((item) => {
      if (!item.data) return '<div class="podium-item"></div>';

      const isMe = item.data.studentId === localStorage.getItem('loginId');

      return `
      <div class="podium-item ${item.position} ${isMe ? 'me' : ''}">
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
        <div class="rank-name">
          ${maskName(user.name, user.studentId)} 
          ${
            isMe
              ? '<span style="color: #6366f1; font-size: 12px;">(나)</span>'
              : ''
          }
        </div>
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
            ${
              hasMe
                ? '<span style="color:#6366f1; margin-left: 10px;">💙 내 구간</span>'
                : ''
            }
          </div>
          <span class="group-expand">▼</span>
        </div>
        <div class="group-content">
          ${users
            .map(
              (user) => `
            <div class="group-member ${user.studentId === myId ? 'me' : ''}">
              <span class="group-member-rank">${user.rank}위</span>
              <span class="group-member-name">
                ${maskName(user.name, user.studentId)}
                ${user.studentId === myId ? ' (나)' : ''}
              </span>
              <span class="group-member-points">+${user.points.toLocaleString()}P</span>
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

// 이름 마스킹 (개인정보 보호)
function maskName(name, studentId) {
  if (!name) return '이름없음';

  // 본인은 전체 이름 표시
  if (studentId === localStorage.getItem('loginId')) {
    return name;
  }

  // 다른 사람은 부분 마스킹
  if (name.length <= 2) {
    return name.charAt(0) + '*';
  }

  const first = name.charAt(0);
  const last = name.charAt(name.length - 1);
  const middle = '*'.repeat(Math.min(name.length - 2, 2));

  return `${first}${middle}${last}`;
}

// 새로고침
window.refreshRanking = async function () {
  if (isLoading) return;

  console.log('랭킹 새로고침');
  showLoadingState();

  try {
    // 캐시 초기화
    rankingData = {
      accumulated: [],
      weekly: [],
    };

    // 데이터 다시 로드
    await loadStudentData();
    await loadRankingData();

    // 화면 업데이트
    updateDisplay();

    // 성공 메시지 (선택사항)
    showToast('랭킹이 업데이트되었습니다!', 'success');
  } catch (error) {
    console.error('새로고침 오류:', error);
    showToast('새로고침 실패. 다시 시도해주세요.', 'error');
  } finally {
    hideLoadingState();
  }
};

// 토스트 메시지 (선택사항)
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast-message ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${
      type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#6366f1'
    };
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    animation: slideDown 0.3s ease;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 2000);
}

// 애니메이션 스타일 추가
if (!document.getElementById('rankingAnimations')) {
  const style = document.createElement('style');
  style.id = 'rankingAnimations';
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    
    @keyframes slideUp {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
    }
    
    .group-member {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 5px;
      font-size: 14px;
    }
    
    .group-member.me {
      background: #f0f1ff;
      border: 1px solid #6366f1;
    }
    
    .group-member-rank {
      font-weight: 600;
      color: #64748b;
      min-width: 35px;
    }
    
    .group-member-name {
      flex: 1;
      margin: 0 10px;
      color: #1a1a1a;
    }
    
    .group-member-points {
      font-weight: 600;
      color: #22c55e;
    }
    
    .podium-item.me .podium-name {
      color: #6366f1;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);
}

console.log('ranking.js 로드 완료 - 실제 주간 데이터 연동 버전');
