// student.js - 학생 페이지 기능 (실제 연동 버전)

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
  document.getElementById('userName').textContent = userName || '학생';

  // 데이터 로드
  await loadStudentData();
  await loadRanking();
  await loadActivityHistory();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 이벤트 카운트다운 시작
  startEventCountdown();
});

// 학생 데이터 로드 - 실제 연동
async function loadStudentData() {
  try {
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      studentData = result.data;
      console.log('학생 데이터:', studentData);

      // 포인트 표시
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

      // 예상 이자 계산
      const expectedInterest = Math.floor(
        (studentData.savingsPoints || 0) * 0.02
      );
      document.getElementById('expectedInterest').textContent =
        expectedInterest;

      // 다음 월요일 표시
      const nextMonday = getNextMonday();
      document.getElementById('nextInterestDate').textContent =
        nextMonday.toLocaleDateString('ko-KR', { weekday: 'long' });
    } else {
      console.error('학생 데이터 로드 실패:', result.error);
      alert('데이터를 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('데이터 로드 오류:', error);
  }
}

// 오늘 획득 포인트 계산
async function calculateTodayPoints() {
  try {
    const result = await api.getPointHistory(studentId);

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

// 활동 내역 로드 - 캐싱 + 최소 로드 버전
async function loadActivityHistory() {
  const activityList = document.getElementById('activityList');

  // 스켈레톤 UI 표시
  activityList.innerHTML = generateSkeletonUI(5);

  try {
    const studentId = localStorage.getItem('loginId');

    // 캐시 확인
    const cacheKey = `activity_${studentId}`;
    let recentActivities = cache.get(cacheKey);

    if (!recentActivities) {
      // 캐시가 없으면 API 호출
      const result = await api.getPointHistory(studentId);

      if (result.success && result.data.length > 0) {
        // 최근 5개만 저장
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

          let timeText = '방금 전';
          if (activity.date) {
            const dateObj = parseKoreanDate(activity.date);
            if (dateObj && !isNaN(dateObj.getTime())) {
              timeText = formatTimeAgo(activity.date);
            } else {
              timeText = activity.date;
            }
          }

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
// 스켈레톤 UI 생성
function generateSkeletonUI(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="activity-item skeleton">
        <div class="activity-left">
          <div class="skeleton-circle"></div>
          <div class="skeleton-text">
            <div class="skeleton-line" style="width: 120px"></div>
            <div class="skeleton-line" style="width: 80px; opacity: 0.5"></div>
          </div>
        </div>
        <div class="skeleton-line" style="width: 60px"></div>
      </div>
    `;
  }
  return html;
}

// 랭킹 로드 - 실제 연동
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
            <span class="rank-number ${rankClass}">${index + 1}</span>
            <div class="rank-info">
              <div class="rank-name">${student.name} ${isMe ? '(나)' : ''}</div>
              <div class="rank-points">${student.currentPoints.toLocaleString()}P</div>
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

// 레벨 표시 헬퍼
function getLevelDisplay(level) {
  const levelMap = {
    씨앗: '🌱 씨앗',
    새싹: '🌿 새싹',
    나무: '🌳 나무',
    큰나무: '🌲 큰나무',
    별: '⭐ 별',
    다이아몬드: '💎 다이아몬드',
  };
  return levelMap[level] || level;
}

// 아이콘 클래스
function getIconClass(type) {
  const classes = {
    attendance: 'icon-earn',
    homework: 'icon-earn',
    test: 'icon-earn',
    purchase: 'icon-spend',
    deposit: 'icon-save',
    withdraw: 'icon-save',
    gift: 'icon-spend',
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
    gift: '🎁',
  };
  return icons[type] || '📝';
}

// formatTimeAgo 함수도 수정
function formatTimeAgo(dateString) {
  try {
    const date = new Date(dateString);

    // 날짜가 유효하지 않으면 원본 문자열 반환
    if (isNaN(date.getTime())) {
      console.log('Invalid date:', dateString);
      return dateString || '날짜 없음';
    }

    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // 초 단위

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;

    return date.toLocaleDateString('ko-KR');
  } catch (error) {
    console.error('날짜 포맷 오류:', error, dateString);
    return '날짜 오류';
  }
}

// 다음 월요일 계산
function getNextMonday() {
  const today = new Date();
  const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday;
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

// 활동 내역 필터링
function filterActivities(tab) {
  console.log('필터:', tab);
  // 실제 필터링 로직 구현
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

// 전역 함수로 내보내기
window.studentData = studentData;
window.loadStudentData = loadStudentData;
