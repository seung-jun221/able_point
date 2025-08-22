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
