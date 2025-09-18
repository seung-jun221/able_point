// dashboard-charts.js - 대시보드 차트 관리

// 차트 인스턴스 저장용
let dashboardCharts = {
  weekly: null,
  distribution: null,
  category: null,
};

// 차트 설정
const CHART_CONFIG = {
  categories: {
    labels: ['연산', '과제', '테스트', '온라인', '벌점'],
    colors: ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444'],
  },
  distribution: {
    labels: ['0-5000P', '5000-10000P', '10000-20000P', '20000P+'],
    colors: ['#fbbf24', '#34d399', '#60a5fa', '#a78bfa'],
    ranges: [5000, 10000, 20000, Infinity],
  },
};

// ==================== 데이터 로드 함수 ====================

// 주간 포인트 데이터 가져오기
async function getWeeklyPointsData(classId) {
  try {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // 월요일
    weekStart.setHours(0, 0, 0, 0);

    let query = supabase
      .from('points')
      .select('amount, created_at, student_id')
      .gte('created_at', weekStart.toISOString())
      .gte('amount', 0);

    if (classId) {
      const { data: students } = await supabase
        .from('students')
        .select('student_id')
        .eq('class_id', classId);

      const studentIds = students?.map((s) => s.student_id) || [];
      if (studentIds.length > 0) {
        query = query.in('student_id', studentIds);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // 요일별로 그룹화 (월~금)
    const dailyPoints = [0, 0, 0, 0, 0];

    data?.forEach((item) => {
      const date = new Date(item.created_at);
      const day = date.getDay();

      if (day >= 1 && day <= 5) {
        dailyPoints[day - 1] += parseInt(item.amount);
      }
    });

    return dailyPoints;
  } catch (error) {
    console.error('주간 포인트 데이터 오류:', error);
    return [0, 0, 0, 0, 0];
  }
}

// 학생별 포인트 분포 데이터
async function getStudentDistributionData(classId) {
  try {
    let query = supabase.from('students').select('current_points');

    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 새로운 구간별 분류
    const distribution = [0, 0, 0, 0];

    data?.forEach((student) => {
      const points = student.current_points || 0;

      if (points < 5000) distribution[0]++;
      else if (points < 10000) distribution[1]++;
      else if (points < 20000) distribution[2]++;
      else distribution[3]++;
    });

    return distribution;
  } catch (error) {
    console.error('포인트 분포 데이터 오류:', error);
    return [0, 0, 0, 0];
  }
}

// 카테고리별 포인트 데이터
async function getCategoryPointsData(classId) {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let query = supabase
      .from('points')
      .select('amount, reason, student_id')
      .gte('created_at', monthStart.toISOString());

    if (classId) {
      const { data: students } = await supabase
        .from('students')
        .select('student_id')
        .eq('class_id', classId);

      const studentIds = students?.map((s) => s.student_id) || [];
      if (studentIds.length > 0) {
        query = query.in('student_id', studentIds);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // 카테고리별 분류
    const categories = {
      math: 0, // 연산
      homework: 0, // 과제
      test: 0, // 테스트
      online: 0, // 온라인
      penalty: 0, // 벌점
    };

    data?.forEach((item) => {
      const reason = item.reason?.toLowerCase() || '';
      const amount = parseInt(item.amount);

      if (reason.includes('연산')) {
        categories.math += Math.abs(amount);
      } else if (reason.includes('과제') || reason.includes('숙제')) {
        categories.homework += Math.abs(amount);
      } else if (reason.includes('테스트') || reason.includes('등급')) {
        categories.test += Math.abs(amount);
      } else if (reason.includes('온라인') || reason.includes('문제풀이')) {
        categories.online += Math.abs(amount);
      } else if (amount < 0) {
        categories.penalty += Math.abs(amount);
      }
    });

    return [
      categories.math,
      categories.homework,
      categories.test,
      categories.online,
      categories.penalty,
    ];
  } catch (error) {
    console.error('카테고리 데이터 오류:', error);
    return [0, 0, 0, 0, 0];
  }
}

// ==================== 차트 생성/업데이트 함수 ====================

// 차트 초기화
async function initDashboardCharts() {
  try {
    console.log('📊 대시보드 차트 초기화 시작...');

    // 기존 차트 제거
    destroyCharts();

    // 현재 선택된 반
    const currentClass = document.getElementById('classSelector')?.value || '';

    // 데이터 로드
    const [weeklyData, distributionData, categoryData] = await Promise.all([
      getWeeklyPointsData(currentClass),
      getStudentDistributionData(currentClass),
      getCategoryPointsData(currentClass),
    ]);

    // 1. 주간 포인트 차트
    createWeeklyChart(weeklyData);

    // 2. 학생 분포 차트
    createDistributionChart(distributionData);

    // 3. 카테고리별 차트
    createCategoryChart(categoryData);

    console.log('✅ 차트 초기화 완료');
  } catch (error) {
    console.error('❌ 차트 초기화 오류:', error);
  }
}

// 주간 차트 생성
function createWeeklyChart(data) {
  const ctx = document.getElementById('weeklyPointsChart');
  if (!ctx) return;

  dashboardCharts.weekly = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['월', '화', '수', '목', '금'],
      datasets: [
        {
          label: '발급 포인트',
          data: data,
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: '#fff',
          pointBorderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => `${context.parsed.y.toLocaleString()}P`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value.toLocaleString() + 'P',
          },
        },
      },
    },
  });
}

// 분포 차트 생성
function createDistributionChart(data) {
  const ctx = document.getElementById('studentDistributionChart');
  if (!ctx) return;

  const totalStudents = data.reduce((a, b) => a + b, 0);

  dashboardCharts.distribution = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: CHART_CONFIG.distribution.labels,
      datasets: [
        {
          data: data,
          backgroundColor: CHART_CONFIG.distribution.colors,
          borderWidth: 2,
          borderColor: '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 15 },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const value = context.parsed;
              const percentage =
                totalStudents > 0
                  ? ((value / totalStudents) * 100).toFixed(1)
                  : '0';
              return `${context.label}: ${value}명 (${percentage}%)`;
            },
          },
        },
      },
    },
  });
}

// 카테고리 차트 생성
function createCategoryChart(data) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return;

  dashboardCharts.category = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: CHART_CONFIG.categories.labels,
      datasets: [
        {
          label: '포인트',
          data: data,
          backgroundColor: CHART_CONFIG.categories.colors,
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => context.parsed.y.toLocaleString() + 'P',
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => value.toLocaleString() + 'P',
          },
        },
      },
    },
  });
}

// ==================== 차트 업데이트 함수 ====================

// 포인트 지급 시 차트 업데이트
function updateChartsAfterPoint(amount, reason) {
  // 주간 차트 업데이트
  if (dashboardCharts.weekly) {
    const today = new Date().getDay();
    const dayIndex = today === 0 || today === 6 ? 4 : today - 1;

    if (dayIndex >= 0 && dayIndex < 5) {
      dashboardCharts.weekly.data.datasets[0].data[dayIndex] += amount;
      dashboardCharts.weekly.update('active');
    }
  }

  // 카테고리 차트 업데이트
  if (dashboardCharts.category && reason) {
    let categoryIndex = -1;
    const reasonLower = reason.toLowerCase();

    if (reasonLower.includes('연산')) categoryIndex = 0;
    else if (reasonLower.includes('과제') || reasonLower.includes('숙제'))
      categoryIndex = 1;
    else if (reasonLower.includes('테스트') || reasonLower.includes('등급'))
      categoryIndex = 2;
    else if (reasonLower.includes('온라인') || reasonLower.includes('문제풀이'))
      categoryIndex = 3;
    else if (amount < 0) categoryIndex = 4;

    if (categoryIndex >= 0) {
      dashboardCharts.category.data.datasets[0].data[categoryIndex] +=
        Math.abs(amount);
      dashboardCharts.category.update('active');
    }
  }
}

// 차트 새로고침
async function refreshDashboardCharts() {
  console.log('🔄 차트 새로고침...');
  await initDashboardCharts();
}

// 차트 제거
function destroyCharts() {
  Object.values(dashboardCharts).forEach((chart) => {
    if (chart) chart.destroy();
  });
  dashboardCharts = {
    weekly: null,
    distribution: null,
    category: null,
  };
}

// ==================== 이벤트 리스너 ====================

// DOM 로드 완료 시
document.addEventListener('DOMContentLoaded', () => {
  // 차트 초기화 (약간의 지연 후)
  setTimeout(() => {
    initDashboardCharts();
  }, 500);

  // 반 선택 변경 시 차트 새로고침
  const classSelector = document.getElementById('classSelector');
  if (classSelector) {
    classSelector.addEventListener('change', () => {
      refreshDashboardCharts();
    });
  }

  // 5분마다 자동 새로고침
  setInterval(() => {
    refreshDashboardCharts();
  }, 5 * 60 * 1000);
});

// ==================== 외부 노출 함수 ====================

// teacher.js에서 호출할 수 있도록 전역 노출
window.dashboardCharts = {
  init: initDashboardCharts,
  refresh: refreshDashboardCharts,
  updateAfterPoint: updateChartsAfterPoint,
  destroy: destroyCharts,
};
