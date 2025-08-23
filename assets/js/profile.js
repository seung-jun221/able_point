// profile.js - 프로필 페이지 기능 (긴급 수정 버전)

// 전역 변수
let studentData = null;
let selectedAvatar = null;
let weeklyChart = null;

// 레벨 시스템 정의 (기존 유지)
const LEVEL_SYSTEM = {
  levels: [
    {
      name: '씨앗',
      icon: '🌱',
      minPoints: 0,
      maxPoints: 999,
      nextThreshold: 1000,
    },
    {
      name: '새싹',
      icon: '🌿',
      minPoints: 1000,
      maxPoints: 2999,
      nextThreshold: 3000,
    },
    {
      name: '나무',
      icon: '🌳',
      minPoints: 3000,
      maxPoints: 4999,
      nextThreshold: 5000,
    },
    {
      name: '큰나무',
      icon: '🌲',
      minPoints: 5000,
      maxPoints: 29999,
      nextThreshold: 30000,
    },
    {
      name: '별',
      icon: '⭐',
      minPoints: 30000,
      maxPoints: 49999,
      nextThreshold: 50000,
    },
    {
      name: '다이아몬드',
      icon: '💎',
      minPoints: 50000,
      maxPoints: null,
      nextThreshold: null,
    },
  ],
};

// 배지 정의 (기존 유지)
const BADGES = [
  { id: 'first_login', name: '첫 발걸음', icon: '👋', condition: '첫 로그인' },
  { id: 'level_sprout', name: '새싹', icon: '🌱', condition: '새싹 레벨 달성' },
  { id: 'level_tree', name: '나무', icon: '🌳', condition: '나무 레벨 달성' },
  {
    id: 'level_forest',
    name: '큰나무',
    icon: '🌲',
    condition: '큰나무 레벨 달성',
  },
  { id: 'level_star', name: '별', icon: '⭐', condition: '별 레벨 달성' },
  {
    id: 'level_diamond',
    name: '다이아몬드',
    icon: '💎',
    condition: '다이아몬드 레벨 달성',
  },
  {
    id: 'points_1000',
    name: '천 포인트',
    icon: '💰',
    condition: '누적 1,000P',
  },
  {
    id: 'points_5000',
    name: '오천 포인트',
    icon: '💵',
    condition: '누적 5,000P',
  },
  {
    id: 'points_10000',
    name: '만 포인트',
    icon: '💸',
    condition: '누적 10,000P',
  },
  {
    id: 'attendance_7',
    name: '주간 개근',
    icon: '📅',
    condition: '7일 연속 출석',
  },
  {
    id: 'attendance_30',
    name: '월간 개근',
    icon: '🗓️',
    condition: '30일 연속 출석',
  },
  { id: 'perfect_test', name: '수학 천재', icon: '💯', condition: '시험 만점' },
  { id: 'helper', name: '도우미', icon: '🤝', condition: '친구 5명 도움' },
  { id: 'saver', name: '저축왕', icon: '🏦', condition: '저축 5,000P 달성' },
  { id: 'donor', name: '기부천사', icon: '😇', condition: '기부 1,000P 달성' },
  { id: 'shopper', name: '쇼핑왕', icon: '🛍️', condition: '상품 10개 구매' },
  { id: 'ranker_top3', name: 'TOP 3', icon: '🥉', condition: '랭킹 3위 이내' },
  { id: 'ranker_top1', name: '챔피언', icon: '🏆', condition: '랭킹 1위' },
  {
    id: 'weekly_star',
    name: '주간 스타',
    icon: '🌟',
    condition: '주간 최다 포인트',
  },
  {
    id: 'mission_complete',
    name: '미션 마스터',
    icon: '🎯',
    condition: '미션 10개 완료',
  },
];

// 아바타 옵션
const AVATAR_OPTIONS = [
  '🦁',
  '🐯',
  '🐻',
  '🐼',
  '🐨',
  '🐰',
  '🦊',
  '🐸',
  '🐵',
  '🐶',
  '🐱',
  '🐭',
  '🐹',
  '🦄',
  '🐷',
  '🐮',
  '🦈',
  '🐙',
  '🦀',
  '🐢',
  '🦜',
  '🦉',
  '🦅',
  '🦆',
];

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  console.log('프로필 페이지 초기화');

  // 로그인 체크
  const loginId = localStorage.getItem('loginId');
  if (!loginId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 데이터 로드
  await loadProfileData();

  // UI 초기화
  initializeUI();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 차트 초기화
  initializeChart();

  // 다크모드 체크
  checkDarkMode();
});

// 프로필 데이터 로드 - 수정됨
async function loadProfileData() {
  try {
    showLoading(true);

    const loginId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(loginId);

    if (result.success) {
      studentData = result.data;
      console.log('프로필 데이터:', studentData);

      // 추가 데이터 계산 - 수정됨
      await calculateAdditionalStats();

      // UI 업데이트
      updateProfileUI();
      updateBadges();

      // 성공한 데이터 캐시에 저장
      localStorage.setItem('profileCache', JSON.stringify(studentData));
    } else {
      throw new Error('데이터 로드 실패');
    }
  } catch (error) {
    console.error('프로필 로드 오류:', error);

    // 캐시된 데이터 확인
    const cachedData = localStorage.getItem('profileCache');
    if (cachedData) {
      studentData = JSON.parse(cachedData);
      console.log('캐시된 데이터 사용');
      updateProfileUI();
      updateBadges();
      showNotification('오프라인 모드: 저장된 데이터를 표시합니다.', 'info');
    } else {
      showNotification('데이터를 불러올 수 없습니다.', 'error');
    }
  } finally {
    showLoading(false);
  }
}

// 추가 통계 계산 - 완전 수정됨
async function calculateAdditionalStats() {
  const loginId = localStorage.getItem('loginId');

  try {
    // 1. 이번달 포인트 계산 - loginId 사용!
    try {
      const historyResult = await api.getPointHistory(loginId); // 수정: loginId 사용
      if (historyResult.success && historyResult.data) {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        const monthlyPoints = historyResult.data
          .filter((item) => {
            const date = new Date(item.date);
            return (
              date.getMonth() === thisMonth &&
              date.getFullYear() === thisYear &&
              parseInt(item.amount) > 0
            );
          })
          .reduce((sum, item) => sum + parseInt(item.amount), 0);

        studentData.monthlyPoints = monthlyPoints;

        // 주간 데이터도 여기서 계산
        calculateWeeklyDataFromHistory(historyResult.data);
      } else {
        studentData.monthlyPoints = 0;
        studentData.weeklyData = [0, 0, 0, 0, 0, 0, 0];
      }
    } catch (error) {
      console.error('히스토리 로드 오류:', error);
      studentData.monthlyPoints = 0;
      studentData.weeklyData = [0, 0, 0, 0, 0, 0, 0];
    }

    // 2. 랭킹 계산 - API 없으면 스킵
    try {
      // api.getRanking이 있는지 확인
      if (typeof api.getRanking === 'function') {
        const rankingResult = await api.getRanking();
        if (rankingResult.success && rankingResult.data) {
          // loginId로 찾기
          const myRank =
            rankingResult.data.findIndex(
              (s) =>
                s.loginId === loginId || s.studentId === studentData.studentId
            ) + 1;
          studentData.ranking = myRank || '-';
        } else {
          studentData.ranking = '-';
        }
      } else {
        // getRanking API가 없으면 기본값
        console.log('getRanking API 없음 - 기본값 사용');
        studentData.ranking = '-';
      }
    } catch (error) {
      console.error('랭킹 계산 오류:', error);
      studentData.ranking = '-';
    }

    // 3. 출석일수 - 로그인 기록에서 계산 (임시)
    try {
      const attendanceDays =
        parseInt(localStorage.getItem('attendanceDays')) || 0;
      studentData.attendanceDays = attendanceDays;
    } catch (error) {
      studentData.attendanceDays = 0;
    }

    // 4. 기부 포인트 - 현재는 0 (나중에 구현)
    studentData.donationPoints = 0;
  } catch (error) {
    console.error('추가 통계 전체 오류:', error);
    // 오류 발생해도 기본값으로 설정
    studentData.monthlyPoints = studentData.monthlyPoints || 0;
    studentData.ranking = studentData.ranking || '-';
    studentData.attendanceDays = studentData.attendanceDays || 0;
    studentData.donationPoints = studentData.donationPoints || 0;
    studentData.weeklyData = studentData.weeklyData || [0, 0, 0, 0, 0, 0, 0];
  }
}

// 주간 데이터 계산 함수 - 새로 추가
function calculateWeeklyDataFromHistory(historyData) {
  try {
    const now = new Date();
    const weeklyData = [0, 0, 0, 0, 0, 0, 0]; // 일~토

    // 오늘부터 일주일 전까지 데이터
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      const dayIndex = targetDate.getDay(); // 0=일요일

      const dayPoints = historyData
        .filter((item) => {
          const itemDate = new Date(item.date);
          return (
            itemDate.toDateString() === targetDate.toDateString() &&
            parseInt(item.amount) > 0
          );
        })
        .reduce((sum, item) => sum + parseInt(item.amount), 0);

      weeklyData[dayIndex] = dayPoints;
    }

    studentData.weeklyData = weeklyData;
  } catch (error) {
    console.error('주간 데이터 계산 오류:', error);
    studentData.weeklyData = [0, 0, 0, 0, 0, 0, 0];
  }
}

// 현재 레벨 정보 가져오기
function getCurrentLevelInfo(totalPoints) {
  for (let i = LEVEL_SYSTEM.levels.length - 1; i >= 0; i--) {
    const level = LEVEL_SYSTEM.levels[i];
    if (totalPoints >= level.minPoints) {
      return level;
    }
  }
  return LEVEL_SYSTEM.levels[0];
}

// 다음 레벨 정보 가져오기
function getNextLevelInfo(currentLevel) {
  const currentIndex = LEVEL_SYSTEM.levels.findIndex(
    (l) => l.name === currentLevel.name
  );
  if (currentIndex < LEVEL_SYSTEM.levels.length - 1) {
    return LEVEL_SYSTEM.levels[currentIndex + 1];
  }
  return null;
}

// 레벨 진행률 계산 (개선된 버전)
function calculateLevelProgress(totalPoints) {
  const currentLevel = getCurrentLevelInfo(totalPoints);
  const nextLevel = getNextLevelInfo(currentLevel);

  if (!nextLevel) {
    // 최고 레벨 달성
    return {
      currentLevel,
      nextLevel: null,
      currentPoints: totalPoints,
      nextThreshold: null,
      pointsToNext: 0,
      progress: 100,
      progressDisplay: `${totalPoints.toLocaleString()}P (최고 레벨)`,
      nextLevelText: '최고 레벨 달성! 🎉',
    };
  }

  // 다음 레벨까지 필요한 포인트
  const pointsToNext = currentLevel.nextThreshold - totalPoints;

  // 현재 레벨 구간 내 진행률
  const levelRangeStart = currentLevel.minPoints;
  const levelRangeEnd = currentLevel.nextThreshold;
  const currentProgress = totalPoints - levelRangeStart;
  const totalRange = levelRangeEnd - levelRangeStart;
  const progressPercentage = (currentProgress / totalRange) * 100;

  return {
    currentLevel,
    nextLevel,
    currentPoints: totalPoints,
    nextThreshold: currentLevel.nextThreshold,
    pointsToNext,
    progress: progressPercentage,
    progressDisplay: `${totalPoints.toLocaleString()} / ${currentLevel.nextThreshold.toLocaleString()}P`,
    nextLevelText: `다음: ${nextLevel.icon} ${nextLevel.name}`,
  };
}

// UI 업데이트
function updateProfileUI() {
  if (!studentData) return;

  // 기본 정보
  const profileName = document.getElementById('profileName');
  if (profileName) profileName.textContent = studentData.name || '학생';

  // 레벨 정보
  const totalPoints = studentData.totalPoints || 0;
  const levelProgress = calculateLevelProgress(totalPoints);

  // 레벨 배지
  const profileLevel = document.getElementById('profileLevel');
  if (profileLevel) {
    profileLevel.textContent = `${levelProgress.currentLevel.icon} ${levelProgress.currentLevel.name}`;
  }

  // 아바타
  const savedAvatar =
    localStorage.getItem('userAvatar') || studentData.avatar || '🦁';
  const avatarEmoji = document.getElementById('avatarEmoji');
  if (avatarEmoji) avatarEmoji.textContent = savedAvatar;

  // 레벨 진행률 업데이트
  updateLevelProgressDisplay(levelProgress);

  // 통계
  const totalPointsStat = document.getElementById('totalPointsStat');
  if (totalPointsStat) {
    totalPointsStat.textContent = `${totalPoints.toLocaleString()}P`;
  }

  const monthlyPointsStat = document.getElementById('monthlyPointsStat');
  if (monthlyPointsStat) {
    monthlyPointsStat.textContent = `+${(
      studentData.monthlyPoints || 0
    ).toLocaleString()}P`;
  }

  const rankingStat = document.getElementById('rankingStat');
  if (rankingStat) {
    rankingStat.textContent =
      studentData.ranking === '-' ? '-' : `${studentData.ranking}위`;
  }

  const attendanceStat = document.getElementById('attendanceStat');
  if (attendanceStat) {
    attendanceStat.textContent = `${studentData.attendanceDays || 0}일`;
  }

  const savingsStat = document.getElementById('savingsStat');
  if (savingsStat) {
    savingsStat.textContent = `${(
      studentData.savingsPoints || 0
    ).toLocaleString()}P`;
  }

  const donationStat = document.getElementById('donationStat');
  if (donationStat) {
    donationStat.textContent = `${(
      studentData.donationPoints || 0
    ).toLocaleString()}P`;
  }
}

// 레벨 진행률 표시 업데이트 (개선된 버전)
function updateLevelProgressDisplay(levelProgress) {
  // 현재 포인트
  const currentTotalPoints = document.getElementById('currentTotalPoints');
  if (currentTotalPoints) {
    currentTotalPoints.textContent = `${levelProgress.currentPoints.toLocaleString()}P`;
  }

  // 다음 레벨까지 남은 포인트
  const pointsToNext = document.getElementById('pointsToNext');
  if (pointsToNext) {
    if (levelProgress.pointsToNext > 0) {
      pointsToNext.textContent = `${levelProgress.pointsToNext.toLocaleString()}P 남음`;
    } else {
      pointsToNext.textContent = '최고 레벨';
    }
  }

  // 프로그레스 바
  const progressBar = document.getElementById('levelProgress');
  if (progressBar) {
    progressBar.style.width = `${Math.min(levelProgress.progress, 100)}%`;
  }

  // 진행률 텍스트
  const progressDisplay = document.getElementById('progressDisplay');
  if (progressDisplay) {
    progressDisplay.textContent = levelProgress.progressDisplay;
  }

  const progressPercentage = document.getElementById('progressPercentage');
  if (progressPercentage) {
    progressPercentage.textContent = `${Math.round(levelProgress.progress)}%`;
  }

  // 다음 레벨 미리보기
  const nextLevelPreview = document.getElementById('nextLevelPreview');
  if (nextLevelPreview) {
    nextLevelPreview.textContent = levelProgress.nextLevelText;
  }

  // 레벨업 임박 효과
  if (levelProgress.pointsToNext > 0 && levelProgress.pointsToNext < 500) {
    if (progressBar) progressBar.classList.add('pulse');
    showNotification(
      `🎯 다음 레벨까지 ${levelProgress.pointsToNext}P!`,
      'info'
    );
  }
}

// 배지 업데이트
function updateBadges() {
  const grid = document.getElementById('achievementGrid');
  if (!grid) return;

  const unlockedBadges = getUnlockedBadges();

  grid.innerHTML = BADGES.map((badge) => {
    const isUnlocked = unlockedBadges.includes(badge.id);
    return `
      <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}" 
           data-badge="${badge.id}"
           title="${badge.name}">
        <span>${isUnlocked ? badge.icon : '🔒'}</span>
        <div class="badge-tooltip">${badge.condition}</div>
      </div>
    `;
  }).join('');

  // 획득 개수 업데이트
  const unlockedCount = document.getElementById('unlockedCount');
  if (unlockedCount) unlockedCount.textContent = unlockedBadges.length;

  const totalBadges = document.getElementById('totalBadges');
  if (totalBadges) totalBadges.textContent = BADGES.length;
}

// 획득한 배지 확인
function getUnlockedBadges() {
  const unlocked = [];
  const points = studentData?.totalPoints || 0;

  // 첫 로그인
  unlocked.push('first_login');

  // 레벨 배지
  if (points >= 1000) unlocked.push('level_sprout');
  if (points >= 3000) unlocked.push('level_tree');
  if (points >= 5000) unlocked.push('level_forest');
  if (points >= 30000) unlocked.push('level_star');
  if (points >= 50000) unlocked.push('level_diamond');

  // 포인트 배지
  if (points >= 1000) unlocked.push('points_1000');
  if (points >= 5000) unlocked.push('points_5000');
  if (points >= 10000) unlocked.push('points_10000');

  // 저축 배지
  if ((studentData?.savingsPoints || 0) >= 5000) unlocked.push('saver');

  // 랭킹 배지
  if (studentData?.ranking && studentData.ranking !== '-') {
    const rank = parseInt(studentData.ranking);
    if (rank <= 3) unlocked.push('ranker_top3');
    if (rank === 1) unlocked.push('ranker_top1');
  }

  return unlocked;
}

// 차트 초기화 - 실제 데이터 사용
function initializeChart() {
  const ctx = document.getElementById('weeklyChart');
  if (!ctx) return;

  // 기존 차트 제거
  if (weeklyChart) {
    weeklyChart.destroy();
  }

  // 주간 데이터 사용 (calculateAdditionalStats에서 계산된 값)
  const weeklyData = studentData?.weeklyData || [0, 0, 0, 0, 0, 0, 0];

  weeklyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['일', '월', '화', '수', '목', '금', '토'],
      datasets: [
        {
          label: '획득 포인트',
          data: weeklyData,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          borderRadius: 8,
          titleFont: {
            size: 13,
          },
          bodyFont: {
            size: 14,
          },
          callbacks: {
            label: function (context) {
              return context.parsed.y + 'P';
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 12,
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            font: {
              size: 12,
            },
            callback: function (value) {
              return value + 'P';
            },
          },
        },
      },
    },
  });
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 알림 토글
  const notificationToggle = document.getElementById('notificationToggle');
  if (notificationToggle) {
    notificationToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      localStorage.setItem('notificationsEnabled', enabled);
      showNotification(
        enabled ? '알림이 켜졌습니다.' : '알림이 꺼졌습니다.',
        'info'
      );
    });
  }

  // 다크모드 토글
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      toggleDarkMode(enabled);
    });
  }

  // 배지 클릭
  document.addEventListener('click', (e) => {
    if (e.target.closest('.badge-item')) {
      const badge = e.target.closest('.badge-item');
      const badgeId = badge.dataset.badge;
      const badgeInfo = BADGES.find((b) => b.id === badgeId);
      if (badgeInfo) {
        showNotification(`${badgeInfo.name}: ${badgeInfo.condition}`, 'info');
      }
    }
  });
}

// 아바타 모달 표시
function showAvatarModal() {
  const modal = document.getElementById('avatarModal');
  const grid = document.getElementById('avatarGrid');

  if (!modal || !grid) return;

  const currentAvatar =
    document.getElementById('avatarEmoji')?.textContent || '🦁';

  grid.innerHTML = AVATAR_OPTIONS.map(
    (avatar) => `
    <div class="avatar-option ${avatar === currentAvatar ? 'selected' : ''}" 
         data-avatar="${avatar}">
      ${avatar}
    </div>
  `
  ).join('');

  // 아바타 선택 이벤트
  grid.querySelectorAll('.avatar-option').forEach((option) => {
    option.addEventListener('click', (e) => {
      grid
        .querySelectorAll('.avatar-option')
        .forEach((o) => o.classList.remove('selected'));
      e.target.classList.add('selected');
      selectedAvatar = e.target.dataset.avatar;
    });
  });

  modal.classList.add('active');
}

// 아바타 모달 닫기
function closeAvatarModal() {
  const modal = document.getElementById('avatarModal');
  if (modal) modal.classList.remove('active');

  if (selectedAvatar) {
    const avatarEmoji = document.getElementById('avatarEmoji');
    if (avatarEmoji) avatarEmoji.textContent = selectedAvatar;
    localStorage.setItem('userAvatar', selectedAvatar);
    showNotification('아바타가 변경되었습니다!', 'success');
    selectedAvatar = null;
  }
}

// 비밀번호 변경
function changePassword() {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.add('active');
}

// 비밀번호 모달 닫기
function closePasswordModal() {
  const modal = document.getElementById('passwordModal');
  if (modal) modal.classList.remove('active');

  // 입력 초기화
  const currentPassword = document.getElementById('currentPassword');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');

  if (currentPassword) currentPassword.value = '';
  if (newPassword) newPassword.value = '';
  if (confirmPassword) confirmPassword.value = '';
}

// 비밀번호 업데이트
async function updatePassword() {
  const current = document.getElementById('currentPassword')?.value;
  const newPass = document.getElementById('newPassword')?.value;
  const confirm = document.getElementById('confirmPassword')?.value;

  if (!current || !newPass || !confirm) {
    showNotification('모든 필드를 입력해주세요.', 'error');
    return;
  }

  if (newPass.length < 4) {
    showNotification('비밀번호는 4자리 이상이어야 합니다.', 'error');
    return;
  }

  if (newPass !== confirm) {
    showNotification('새 비밀번호가 일치하지 않습니다.', 'error');
    return;
  }

  try {
    // API 호출 (실제 구현 필요)
    // const result = await api.changePassword(studentId, current, newPass);

    showNotification('비밀번호가 변경되었습니다.', 'success');
    closePasswordModal();
  } catch (error) {
    showNotification('비밀번호 변경에 실패했습니다.', 'error');
  }
}

// 데이터 내보내기
function showDataExport() {
  if (confirm('내 활동 데이터를 다운로드하시겠습니까?')) {
    exportData();
  }
}

// 데이터 내보내기 실행
function exportData() {
  if (!studentData) {
    showNotification('데이터를 불러올 수 없습니다.', 'error');
    return;
  }

  const data = {
    profile: {
      name: studentData.name,
      class: studentData.className || studentData.classId,
      level: getCurrentLevelInfo(studentData.totalPoints || 0).name,
      totalPoints: studentData.totalPoints || 0,
      currentPoints: studentData.currentPoints || 0,
      savingsPoints: studentData.savingsPoints || 0,
    },
    statistics: {
      monthlyPoints: studentData.monthlyPoints || 0,
      ranking: studentData.ranking || '-',
      attendanceDays: studentData.attendanceDays || 0,
      donationPoints: studentData.donationPoints || 0,
    },
    badges: getUnlockedBadges(),
    exportDate: new Date().toISOString(),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pointbank_${studentData.name}_${new Date().getTime()}.json`;
  a.click();

  showNotification('데이터를 다운로드했습니다.', 'success');
}

// 다크모드 토글
function toggleDarkMode(enabled) {
  if (enabled) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'false');
  }
}

// 다크모드 체크
function checkDarkMode() {
  const darkMode = localStorage.getItem('darkMode') === 'true';
  if (darkMode) {
    document.body.classList.add('dark-mode');
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) darkModeToggle.checked = true;
  }
}

// 로그아웃
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}

// 알림 표시
function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `notification-toast ${type} show`;

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
  };

  toast.innerHTML = `
    <span class="notification-icon">${icons[type]}</span>
    <span class="notification-message">${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// 로딩 표시
function showLoading(show) {
  if (show) {
    document.body.style.opacity = '0.7';
    document.body.style.pointerEvents = 'none';
  } else {
    document.body.style.opacity = '1';
    document.body.style.pointerEvents = 'auto';
  }
}

// UI 초기화
function initializeUI() {
  // 저장된 설정 불러오기
  const notificationToggle = document.getElementById('notificationToggle');
  if (notificationToggle) {
    const notificationsEnabled =
      localStorage.getItem('notificationsEnabled') !== 'false';
    notificationToggle.checked = notificationsEnabled;
  }
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach((modal) => {
      modal.classList.remove('active');
    });
  }
});

// 전역 함수로 내보내기
window.showAvatarModal = showAvatarModal;
window.closeAvatarModal = closeAvatarModal;
window.changePassword = changePassword;
window.closePasswordModal = closePasswordModal;
window.updatePassword = updatePassword;
window.showDataExport = showDataExport;
window.logout = logout;
window.showEditModal = function () {
  showNotification('프로필 편집 기능은 준비 중입니다.', 'info');
};

// 레벨업 축하 효과 (보너스 기능)
function celebrateLevelUp(newLevel) {
  // 컨페티 효과 (라이브러리 없이 간단히 구현)
  const colors = ['#fbbf24', '#f59e0b', '#6366f1', '#ec4899', '#10b981'];
  const confettiCount = 50;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
     position: fixed;
     width: 10px;
     height: 10px;
     background: ${colors[Math.floor(Math.random() * colors.length)]};
     left: ${Math.random() * 100}%;
     top: -10px;
     z-index: 9999;
     animation: confettiFall ${2 + Math.random() * 2}s ease-out;
     border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
   `;
    document.body.appendChild(confetti);

    setTimeout(() => {
      document.body.removeChild(confetti);
    }, 4000);
  }

  // 레벨업 모달
  const levelUpModal = document.createElement('div');
  levelUpModal.className = 'level-up-modal';
  levelUpModal.innerHTML = `
   <div class="level-up-content">
     <div class="level-up-icon">${newLevel.icon}</div>
     <h2>🎉 레벨업! 🎉</h2>
     <p class="level-up-title">${newLevel.name} 달성!</p>
     <div class="level-up-rewards">
       <p>보상:</p>
       <ul>
         <li>✨ ${newLevel.name} 배지 획득</li>
         <li>💰 보너스 포인트 +500P</li>
         <li>📈 저축 한도 증가</li>
       </ul>
     </div>
     <button onclick="this.parentElement.parentElement.remove()" class="btn btn-primary">
       확인
     </button>
   </div>
 `;

  // 스타일 추가
  const style = document.createElement('style');
  style.textContent = `
   @keyframes confettiFall {
     to {
       transform: translateY(100vh) rotate(360deg);
       opacity: 0;
     }
   }
   
   .level-up-modal {
     position: fixed;
     top: 0;
     left: 0;
     right: 0;
     bottom: 0;
     background: rgba(0, 0, 0, 0.7);
     display: flex;
     align-items: center;
     justify-content: center;
     z-index: 5000;
     animation: fadeIn 0.3s;
   }
   
   .level-up-content {
     background: white;
     border-radius: 24px;
     padding: 40px;
     text-align: center;
     max-width: 400px;
     animation: bounceIn 0.5s;
   }
   
   .level-up-icon {
     font-size: 80px;
     margin-bottom: 20px;
     animation: pulse 1s infinite;
   }
   
   .level-up-content h2 {
     font-size: 32px;
     color: #1a1a1a;
     margin-bottom: 10px;
   }
   
   .level-up-title {
     font-size: 24px;
     color: #6366f1;
     font-weight: bold;
     margin-bottom: 20px;
   }
   
   .level-up-rewards {
     background: #f8f9fa;
     border-radius: 12px;
     padding: 20px;
     margin: 20px 0;
     text-align: left;
   }
   
   .level-up-rewards p {
     font-weight: bold;
     margin-bottom: 10px;
     color: #1a1a1a;
   }
   
   .level-up-rewards ul {
     list-style: none;
     padding: 0;
     margin: 0;
   }
   
   .level-up-rewards li {
     padding: 5px 0;
     color: #333;
   }
   
   @keyframes bounceIn {
     0% {
       transform: scale(0.3);
       opacity: 0;
     }
     50% {
       transform: scale(1.05);
     }
     70% {
       transform: scale(0.9);
     }
     100% {
       transform: scale(1);
       opacity: 1;
     }
   }
 `;

  document.head.appendChild(style);
  document.body.appendChild(levelUpModal);

  // 사운드 효과 (선택사항)
  playSound('levelup');
}

// 사운드 재생 (선택사항)
function playSound(type) {
  try {
    // Web Audio API를 사용한 간단한 사운드
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'levelup') {
      // 레벨업 사운드: 상승하는 음
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.exponentialRampToValueAtTime(
        1046.5,
        audioContext.currentTime + 0.2
      ); // C6
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5
      );
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log('사운드 재생 실패:', error);
  }
}

// 실시간 포인트 업데이트 체크 (선택사항)
function checkForUpdates() {
  setInterval(async () => {
    const loginId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(loginId);

    if (result.success) {
      const oldPoints = studentData?.totalPoints || 0;
      const newPoints = result.data.totalPoints || 0;

      if (newPoints > oldPoints) {
        // 포인트 증가 알림
        const gained = newPoints - oldPoints;
        showNotification(`🎉 ${gained}P 획득!`, 'success');

        // 레벨업 체크
        const oldLevel = getCurrentLevelInfo(oldPoints);
        const newLevel = getCurrentLevelInfo(newPoints);

        if (oldLevel.name !== newLevel.name) {
          celebrateLevelUp(newLevel);
        }

        // 데이터 업데이트
        studentData = result.data;
        updateProfileUI();
      }
    }
  }, 30000); // 30초마다 체크
}

// 디버그 모드 (개발용)
const DEBUG_MODE = false;

if (DEBUG_MODE) {
  window.debugLevelUp = function (points) {
    if (!studentData) studentData = {};
    studentData.totalPoints = points;
    updateProfileUI();

    const levelInfo = getCurrentLevelInfo(points);
    celebrateLevelUp(levelInfo);
  };

  window.debugAddPoints = function (points) {
    if (!studentData) studentData = { totalPoints: 0 };
    studentData.totalPoints += points;
    updateProfileUI();
    showNotification(`+${points}P 추가됨`, 'success');
  };

  console.log('디버그 모드 활성화');
  console.log('사용 가능한 명령:');
  console.log('- debugLevelUp(30000): 특정 포인트로 설정');
  console.log('- debugAddPoints(1000): 포인트 추가');
}

// 초기화 완료 로그
console.log('프로필 페이지 초기화 완료');

// profile.js에 추가할 배지 보상 시스템

// 배지 상세 정보 (획득 방법 포함)
const BADGE_DETAILS = {
  first_login: {
    name: '첫 발걸음',
    icon: '👋',
    condition: '첫 로그인',
    howTo: '포인트 뱅크에 처음 로그인하면 자동으로 획득됩니다.',
    points: 50,
  },
  level_sprout: {
    name: '새싹',
    icon: '🌱',
    condition: '새싹 레벨 달성',
    howTo: '총 1,000 포인트를 모으면 새싹 레벨과 함께 획득됩니다.',
    points: 100,
  },
  level_tree: {
    name: '나무',
    icon: '🌳',
    condition: '나무 레벨 달성',
    howTo: '총 3,000 포인트를 모으면 나무 레벨과 함께 획득됩니다.',
    points: 200,
  },
  level_forest: {
    name: '큰나무',
    icon: '🌲',
    condition: '큰나무 레벨 달성',
    howTo: '총 5,000 포인트를 모으면 큰나무 레벨과 함께 획득됩니다.',
    points: 300,
  },
  level_star: {
    name: '별',
    icon: '⭐',
    condition: '별 레벨 달성',
    howTo: '총 30,000 포인트를 모으면 별 레벨과 함께 획득됩니다.',
    points: 500,
  },
  level_diamond: {
    name: '다이아몬드',
    icon: '💎',
    condition: '다이아몬드 레벨 달성',
    howTo:
      '총 50,000 포인트를 모으면 최고 레벨인 다이아몬드와 함께 획득됩니다.',
    points: 1000,
  },
  points_1000: {
    name: '천 포인트',
    icon: '💰',
    condition: '누적 1,000P',
    howTo: '총 누적 포인트가 1,000P를 넘으면 획득됩니다.',
    points: 50,
  },
  points_5000: {
    name: '오천 포인트',
    icon: '💵',
    condition: '누적 5,000P',
    howTo: '총 누적 포인트가 5,000P를 넘으면 획득됩니다.',
    points: 100,
  },
  points_10000: {
    name: '만 포인트',
    icon: '💸',
    condition: '누적 10,000P',
    howTo: '총 누적 포인트가 10,000P를 넘으면 획득됩니다.',
    points: 200,
  },
  attendance_7: {
    name: '주간 개근',
    icon: '📅',
    condition: '7일 연속 출석',
    howTo: '7일 연속으로 로그인하면 획득됩니다. 하루라도 빠지면 다시 시작!',
    points: 150,
  },
  attendance_30: {
    name: '월간 개근',
    icon: '🗓️',
    condition: '30일 연속 출석',
    howTo: '30일 연속으로 로그인하면 획득됩니다. 꾸준함이 중요해요!',
    points: 500,
  },
  perfect_test: {
    name: '수학 천재',
    icon: '💯',
    condition: '시험 만점',
    howTo: '퀴즈나 시험에서 100점을 받으면 획득됩니다.',
    points: 300,
  },
  helper: {
    name: '도우미',
    icon: '🤝',
    condition: '친구 5명 도움',
    howTo: '친구 5명을 도와주면 획득됩니다. 나눔의 기쁨을 느껴보세요!',
    points: 200,
  },
  saver: {
    name: '저축왕',
    icon: '🏦',
    condition: '저축 5,000P 달성',
    howTo: '저축 계좌에 5,000P 이상 저축하면 획득됩니다.',
    points: 300,
  },
  donor: {
    name: '기부천사',
    icon: '😇',
    condition: '기부 1,000P 달성',
    howTo: '총 1,000P 이상 기부하면 획득됩니다. 따뜻한 마음!',
    points: 400,
  },
  shopper: {
    name: '쇼핑왕',
    icon: '🛍️',
    condition: '상품 10개 구매',
    howTo: '상점에서 상품을 10개 이상 구매하면 획득됩니다.',
    points: 150,
  },
  ranker_top3: {
    name: 'TOP 3',
    icon: '🥉',
    condition: '랭킹 3위 이내',
    howTo: '전체 랭킹에서 3위 안에 들면 획득됩니다. 화이팅!',
    points: 500,
  },
  ranker_top1: {
    name: '챔피언',
    icon: '🏆',
    condition: '랭킹 1위',
    howTo: '전체 랭킹 1위를 달성하면 획득됩니다. 당신이 최고!',
    points: 1000,
  },
  weekly_star: {
    name: '주간 스타',
    icon: '🌟',
    condition: '주간 최다 포인트',
    howTo: '한 주 동안 가장 많은 포인트를 획득한 학생에게 주어집니다.',
    points: 300,
  },
  mission_complete: {
    name: '미션 마스터',
    icon: '🎯',
    condition: '미션 10개 완료',
    howTo: '주어진 미션을 10개 이상 완료하면 획득됩니다.',
    points: 250,
  },
};

// 배지 컬렉션 보상 시스템
const COLLECTION_REWARDS = {
  5: { points: 100, message: '5개 달성! 100P 보너스 획득!' },
  10: { points: 200, message: '10개 달성! 200P 보너스 획득!' },
  15: { points: 500, message: '15개 달성! 500P 보너스 획득!' },
  20: { points: 2000, message: '전체 컬렉션 완성! 2000P 대박 보너스!' },
};

// 배지 클릭 시 상세 정보 팝업
function showBadgeDetail(badgeId) {
  const badge = BADGE_DETAILS[badgeId];
  if (!badge) return;

  // 팝업 HTML 생성
  const popupHTML = `
    <div id="badgeDetailPopup" class="badge-popup-overlay" onclick="closeBadgePopup(event)">
      <div class="badge-popup-content">
        <button class="popup-close" onclick="closeBadgePopup(event)">×</button>
        
        <div class="popup-badge-icon">${badge.icon}</div>
        
        <h3 class="popup-badge-name">${badge.name}</h3>
        
        <div class="popup-badge-condition">${badge.condition}</div>
        
        <div class="popup-section">
          <h4>🎯 획득 방법</h4>
          <p>${badge.howTo}</p>
        </div>
        
        <div class="popup-section">
          <h4>🎁 보상</h4>
          <p class="popup-reward">+${badge.points}P</p>
        </div>
        
        <div class="popup-footer">
          ${
            getUnlockedBadges().includes(badgeId)
              ? '<span class="badge-status unlocked">✅ 획득 완료!</span>'
              : '<span class="badge-status locked">🔒 미획득</span>'
          }
        </div>
      </div>
    </div>
  `;

  // 팝업 추가
  document.body.insertAdjacentHTML('beforeend', popupHTML);

  // 애니메이션을 위한 약간의 지연
  setTimeout(() => {
    document.getElementById('badgeDetailPopup').classList.add('show');
  }, 10);
}

// 팝업 닫기
function closeBadgePopup(event) {
  if (event) {
    event.stopPropagation();
    // 팝업 내용 클릭 시 닫히지 않도록
    if (
      event.target.closest('.badge-popup-content') &&
      !event.target.classList.contains('popup-close')
    ) {
      return;
    }
  }

  const popup = document.getElementById('badgeDetailPopup');
  if (popup) {
    popup.classList.remove('show');
    setTimeout(() => {
      popup.remove();
    }, 300);
  }
}

// 배지 컬렉션 보상 체크 및 지급
function checkCollectionRewards() {
  const unlockedCount = getUnlockedBadges().length;
  const loginId = localStorage.getItem('loginId');

  // 이미 받은 보상 체크
  const receivedRewards = JSON.parse(
    localStorage.getItem('receivedBadgeRewards') || '[]'
  );

  let totalBonus = 0;
  let messages = [];

  // 각 단계별 보상 체크
  Object.entries(COLLECTION_REWARDS).forEach(([threshold, reward]) => {
    const thresholdNum = parseInt(threshold);
    if (
      unlockedCount >= thresholdNum &&
      !receivedRewards.includes(thresholdNum)
    ) {
      totalBonus += reward.points;
      messages.push(reward.message);
      receivedRewards.push(thresholdNum);
    }
  });

  // 새로운 보상이 있으면 지급
  if (totalBonus > 0) {
    // 로컬 스토리지 업데이트
    localStorage.setItem(
      'receivedBadgeRewards',
      JSON.stringify(receivedRewards)
    );

    // 포인트 지급 (실제 API 호출 필요)
    // api.addPoints(loginId, totalBonus, 'badge_collection', '배지 컬렉션 보상');

    // 축하 메시지 표시
    showCollectionRewardPopup(messages, totalBonus);
  }

  // 진행 상황 업데이트
  updateCollectionProgress(unlockedCount);
}

// 컬렉션 진행 상황 표시
function updateCollectionProgress(unlockedCount) {
  // 다음 목표 찾기
  let nextThreshold = null;
  let nextReward = null;

  for (const [threshold, reward] of Object.entries(COLLECTION_REWARDS)) {
    if (parseInt(threshold) > unlockedCount) {
      nextThreshold = parseInt(threshold);
      nextReward = reward;
      break;
    }
  }

  // 진행 상황 HTML 업데이트
  const progressHTML = `
    <div class="collection-progress">
      <div class="progress-header">
        <span>🏆 배지 컬렉션</span>
        <span>${unlockedCount}/20</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${
          (unlockedCount / 20) * 100
        }%"></div>
      </div>
      ${
        nextThreshold
          ? `
        <div class="next-reward">
          다음 보상: ${nextThreshold}개 달성 시 ${nextReward.points}P
        </div>
      `
          : `
        <div class="next-reward complete">
          🎉 모든 배지 획득 완료!
        </div>
      `
      }
    </div>
  `;

  // achievement-card 아래에 추가
  const achievementCard = document.querySelector('.achievement-card');
  const existingProgress = document.querySelector('.collection-progress');

  if (existingProgress) {
    existingProgress.outerHTML = progressHTML;
  } else if (achievementCard) {
    achievementCard.insertAdjacentHTML('beforeend', progressHTML);
  }
}

// 보상 획득 축하 팝업
function showCollectionRewardPopup(messages, totalPoints) {
  const popupHTML = `
    <div id="rewardPopup" class="reward-popup-overlay">
      <div class="reward-popup-content">
        <div class="reward-celebration">🎉</div>
        <h2>배지 컬렉션 보상!</h2>
        ${messages
          .map((msg) => `<p class="reward-message">${msg}</p>`)
          .join('')}
        <div class="reward-total">
          총 ${totalPoints}P 획득!
        </div>
        <button class="reward-confirm" onclick="closeRewardPopup()">확인</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', popupHTML);

  setTimeout(() => {
    document.getElementById('rewardPopup').classList.add('show');
  }, 10);

  // 컨페티 효과
  createConfetti();
}

// 보상 팝업 닫기
function closeRewardPopup() {
  const popup = document.getElementById('rewardPopup');
  if (popup) {
    popup.classList.remove('show');
    setTimeout(() => {
      popup.remove();
    }, 300);
  }
}

// 간단한 컨페티 효과
function createConfetti() {
  const colors = ['#fbbf24', '#f59e0b', '#6366f1', '#ec4899', '#10b981'];
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: -10px;
      z-index: 10000;
      animation: confettiFall ${2 + Math.random() * 2}s ease-out;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
    `;
    document.body.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, 4000);
  }
}

// 배지 업데이트 함수 수정 (클릭 이벤트 추가)
function updateBadgesWithClick() {
  const grid = document.getElementById('achievementGrid');
  if (!grid) return;

  const unlockedBadges = getUnlockedBadges();

  grid.innerHTML = Object.keys(BADGE_DETAILS)
    .map((badgeId) => {
      const badge = BADGE_DETAILS[badgeId];
      const isUnlocked = unlockedBadges.includes(badgeId);
      return `
      <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}" 
           data-badge="${badgeId}"
           onclick="showBadgeDetail('${badgeId}')"
           style="cursor: pointer;">
        <span>${isUnlocked ? badge.icon : '🔒'}</span>
      </div>
    `;
    })
    .join('');

  // 획득 개수 업데이트
  const unlockedCount = document.getElementById('unlockedCount');
  if (unlockedCount) unlockedCount.textContent = unlockedBadges.length;

  const totalBadges = document.getElementById('totalBadges');
  if (totalBadges) totalBadges.textContent = Object.keys(BADGE_DETAILS).length;

  // 컬렉션 보상 체크
  checkCollectionRewards();
}

// 기존 updateBadges 함수 대체
window.updateBadges = updateBadgesWithClick;

// 전역 함수로 내보내기
window.showBadgeDetail = showBadgeDetail;
window.closeBadgePopup = closeBadgePopup;
window.closeRewardPopup = closeRewardPopup;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  // 배지 업데이트 시 컬렉션 체크
  if (typeof updateBadges === 'function') {
    const originalUpdateBadges = updateBadges;
    updateBadges = function () {
      originalUpdateBadges();
      updateBadgesWithClick();
    };
  }
});
