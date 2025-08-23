// assets/js/student.js - 수정된 버전

// 전역 변수 - 수정
const loginId = localStorage.getItem('loginId'); // S001
const studentId = localStorage.getItem('studentId'); // STU001
const userId = localStorage.getItem('userId'); // U001
const userName = localStorage.getItem('userName');

let studentData = null;
let allStudents = [];

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  // 로그인 체크 - 수정
  if (!loginId || !userId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 사용자 이름 표시
  document.getElementById('userName').textContent = userName || '학생';

  // 데이터 로드 - loginId 사용
  await loadStudentData();
  await loadRanking();
  await loadActivityHistory();

  setupEventListeners();
  startEventCountdown();
});

// 학생 데이터 로드 - 수정
async function loadStudentData() {
  try {
    // ✅ loginId를 사용하여 조회
    const result = await api.getStudentPoints(loginId);

    if (result.success) {
      studentData = result.data;
      console.log('학생 데이터:', studentData);

      // UI 업데이트
      document.getElementById('totalPoints').textContent =
        (studentData.currentPoints || 0).toLocaleString() + 'P';
      document.getElementById('savingsAmount').textContent =
        (studentData.savingsPoints || 0).toLocaleString() + 'P';
      document.getElementById('totalEarned').textContent =
        (studentData.totalPoints || 0).toLocaleString() + 'P';

      const totalSpent = Math.max(
        0,
        studentData.totalPoints -
          studentData.currentPoints -
          studentData.savingsPoints
      );
      document.getElementById('totalSpent').textContent =
        totalSpent.toLocaleString() + 'P';

      // 레벨 표시
      const levelText = getLevelDisplay(studentData.level);
      document.getElementById('userLevel').textContent = levelText;

      // 아바타 표시
      if (studentData.avatar) {
        document.getElementById('userAvatar').textContent = studentData.avatar;
      }

      // 오늘 획득 포인트 계산
      await calculateTodayPoints();
    } else {
      console.error('학생 데이터 로드 실패:', result.error);
      alert('데이터를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('데이터 로드 오류:', error);
  }
}

// 오늘 획득 포인트 계산 - 수정
async function calculateTodayPoints() {
  try {
    // ✅ loginId 사용
    const result = await api.getPointHistory(loginId);

    if (result.success) {
      const today = new Date().toDateString();
      const todayPoints = result.data
        .filter((item) => new Date(item.date).toDateString() === today)
        .filter((item) => item.amount > 0)
        .reduce((sum, item) => sum + parseInt(item.amount), 0);

      document.getElementById('todayPoints').textContent = `+${todayPoints}P`;
    }
  } catch (error) {
    console.error('오늘 포인트 계산 오류:', error);
  }
}

// 활동 내역 로드 - 수정
async function loadActivityHistory() {
  const activityList = document.getElementById('activityList');
  activityList.innerHTML = generateSkeletonUI(5);

  try {
    // ✅ loginId 사용
    const cacheKey = `activity_${loginId}`;
    let recentActivities = cache.get(cacheKey);

    if (!recentActivities) {
      const result = await api.getPointHistory(loginId);

      if (result.success && result.data.length > 0) {
        recentActivities = result.data.slice(0, 5);
        cache.set(cacheKey, recentActivities);
      }
    }

    if (recentActivities && recentActivities.length > 0) {
      activityList.innerHTML = recentActivities
        .map((activity) => {
          const iconClass = getIconClass(activity.type);
          const icon = getIcon(activity.type);
          const pointsClass =
            activity.amount > 0 ? 'points-positive' : 'points-negative';
          const amountText =
            activity.amount > 0
              ? `+${activity.amount}P`
              : `${activity.amount}P`;

          // 날짜 처리 - Supabase ISO 형식 대응
          const timeText = formatTimeAgo(activity.date);

          return `
          <div class="activity-item fade-in">
            <div class="activity-left">
              <div class="activity-icon ${iconClass}">${icon}</div>
              <div class="activity-info">
                <span class="activity-title">${
                  activity.reason || activity.type || '포인트 활동'
                }</span>
                <span class="activity-time">${timeText}</span>
              </div>
            </div>
            <span class="activity-points ${pointsClass}">${amountText}</span>
          </div>
        `;
        })
        .join('');
    } else {
      activityList.innerHTML =
        '<div class="no-data">아직 활동 내역이 없습니다.</div>';
    }
  } catch (error) {
    console.error('활동 내역 로드 오류:', error);
    activityList.innerHTML =
      '<div class="error">데이터를 불러올 수 없습니다.</div>';
  }
}
// 레벨 표시 헬퍼 함수
function getLevelDisplay(level) {
  const levelIcons = {
    씨앗: '🌱',
    새싹: '🌿',
    나무: '🌳',
    큰나무: '🌲',
    별: '⭐',
    다이아몬드: '💎',
  };
  return `${levelIcons[level] || '🌱'} ${level}`;
}

// 랭킹 로드 함수
async function loadRanking() {
  const rankingList = document.getElementById('rankingList');
  if (!rankingList) return;

  try {
    const result = await api.getRanking();
    if (result.success && result.data) {
      // 상위 5명만 표시
      const top5 = result.data.slice(0, 5);
      rankingList.innerHTML = top5
        .map(
          (student, index) => `
        <div class="rank-item ${
          student.studentId === localStorage.getItem('studentId') ? 'me' : ''
        }">
          <div class="rank-number rank-${index + 1}">${index + 1}</div>
          <div class="rank-info">
            <div class="rank-name">${student.name}</div>
            <div class="rank-points">${student.currentPoints.toLocaleString()}P</div>
          </div>
        </div>
      `
        )
        .join('');
    }
  } catch (error) {
    console.error('랭킹 로드 오류:', error);
    rankingList.innerHTML =
      '<div class="no-data">랭킹을 불러올 수 없습니다</div>';
  }
}

// 시간 포맷 함수
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // 초 단위

  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;

  return date.toLocaleDateString('ko-KR');
}

// 아이콘 클래스 가져오기
function getIconClass(type) {
  const classes = {
    attendance: 'icon-earn',
    homework: 'icon-earn',
    test: 'icon-earn',
    purchase: 'icon-spend',
    deposit: 'icon-save',
    withdraw: 'icon-save',
    interest: 'icon-earn',
    gift: 'icon-gift',
  };
  return classes[type] || 'icon-earn';
}

// 아이콘 가져오기
function getIcon(type) {
  const icons = {
    attendance: '✅',
    homework: '📚',
    test: '💯',
    purchase: '🛍️',
    deposit: '💰',
    withdraw: '💸',
    interest: '💎',
    gift: '🎁',
  };
  return icons[type] || '✨';
}

// 스켈레톤 UI 생성
function generateSkeletonUI(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="activity-item skeleton">
        <div class="activity-left">
          <div class="skeleton-circle"></div>
          <div class="activity-info">
            <div class="skeleton-line" style="width: 120px"></div>
            <div class="skeleton-line" style="width: 80px"></div>
          </div>
        </div>
        <div class="skeleton-line" style="width: 60px"></div>
      </div>
    `;
  }
  return html;
}

// setupEventListeners 함수 추가
function setupEventListeners() {
  // 네비게이션 이벤트
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', function (e) {
      // 현재 페이지가 아닌 경우에만 이동
      const page = this.dataset.page;
      if (page && !this.classList.contains('active')) {
        // 페이지 이동 로직
        console.log('Navigate to:', page);
      }
    });
  });

  // 이벤트 위임으로 동적 요소 처리
  document.addEventListener('click', function (e) {
    // 동적으로 생성된 요소들의 클릭 이벤트 처리
    if (e.target.closest('.activity-item')) {
      console.log('Activity item clicked');
    }
  });
}

// 이벤트 카운트다운 시작
function startEventCountdown() {
  const updateCountdown = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    nextMonth.setHours(16, 30, 0, 0); // 4:30 PM

    const diff = nextMonth - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const countdownEl = document.getElementById('eventCountdown');
    const dateEl = document.getElementById('eventDate');

    if (countdownEl) countdownEl.textContent = `D-${days}`;
    if (dateEl) {
      dateEl.textContent = nextMonth.toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: 'numeric',
        minute: 'numeric',
      });
    }
  };

  updateCountdown();
  setInterval(updateCountdown, 60000); // 1분마다 업데이트
}
