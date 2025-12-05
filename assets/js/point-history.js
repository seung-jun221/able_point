// point-history.js - 포인트 지급 관리 타임라인 기능

// 전역 변수
let currentClass = '';
let currentDateRange = 'today';
let currentFilter = 'all';
let pointHistory = [];
let classStudents = [];
let duplicateChecks = [];

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('포인트 지급 관리 페이지 초기화');

  // 🔒 서버에서 역할 검증 (가장 먼저 실행)
  const loginId = localStorage.getItem('loginId');

  if (!loginId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // DB에서 실제 역할 확인
  const { data: userCheck, error: userError } = await supabase
    .from('users')
    .select('role, name, is_active')
    .eq('login_id', loginId)
    .single();

  if (userError || !userCheck) {
    alert('사용자 정보를 확인할 수 없습니다.');
    localStorage.clear();
    window.location.href = '../login.html';
    return;
  }

  if (!['teacher', 'principal'].includes(userCheck.role)) {
    alert('이 페이지에 접근할 권한이 없습니다.');
    if (userCheck.role === 'student') {
      window.location.href = '../student/index.html';
    } else {
      window.location.href = '../login.html';
    }
    return;
  }

  console.log('✅ point-history.js 접근 허용:', userCheck.role);

  const userRole = userCheck.role;
  const userName = userCheck.name || localStorage.getItem('userName');

  // 사용자 정보 표시
  document.getElementById('teacherName').textContent = userName || '선생님';
  document.getElementById('userRole').textContent =
    userRole === 'principal' ? '원장' : '선생님';

  // 관리자 메뉴 표시 (서버에서 받은 역할로 확인)
  if (userRole === 'principal') {
    document.getElementById('adminSection').style.display = 'block';
  }

  // 세션에서 선택된 반 복원
  currentClass = sessionStorage.getItem('selectedClass') || '';

  // 반 선택 초기화
  await loadClasses();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 초기 데이터 로드
  await loadData();
});

// ==================== 반 관리 ====================
async function loadClasses() {
  try {
    const { data: classes, error } = await supabase
      .from('classes')
      .select('*')
      .order('class_name');

    if (error) throw error;

    const selector = document.getElementById('classSelector');
    selector.innerHTML = '<option value="">전체 반</option>';

    classes.forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls.class_id;
      option.textContent = cls.class_name;
      selector.appendChild(option);
    });

    // 저장된 반 선택
    if (currentClass) {
      selector.value = currentClass;
      showClassInfo(currentClass);
    }
  } catch (error) {
    console.error('반 목록 로드 실패:', error);
  }
}

function showClassInfo(classId) {
  const classInfo = document.getElementById('classInfo');
  if (classId) {
    classInfo.style.display = 'block';
    loadClassStudents(classId);
  } else {
    classInfo.style.display = 'none';
  }
}

async function loadClassStudents(classId) {
  try {
    const { data: students, error } = await supabase
      .from('student_details')
      .select('*')
      .eq('class_id', classId)
      .order('name');

    if (error) throw error;

    classStudents = students || [];

    // 반 정보 업데이트
    document.getElementById('selectedClassName').textContent =
      document.querySelector(
        `#classSelector option[value="${classId}"]`
      ).textContent;
    document.getElementById('totalStudentCount').textContent =
      classStudents.length;
    document.getElementById('totalStudentCount2').textContent =
      classStudents.length;

    // 오늘 지급 정보 계산
    await updateTodayStats();
  } catch (error) {
    console.error('학생 목록 로드 실패:', error);
  }
}

// ==================== 데이터 로드 ====================
async function loadData() {
  showLoading(true);

  try {
    // 날짜 범위 계산
    const { startDate, endDate } = getDateRange(currentDateRange);

    // 포인트 지급 내역 조회
    let query = supabase
      .from('points')
      .select(
        `
                *,
                students!inner(
                    student_id,
                    name,
                    class_id
                )
            `
      )
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    // 반 필터 적용
    if (currentClass) {
      query = query.eq('students.class_id', currentClass);
    }

    const { data, error } = await query;

    if (error) throw error;

    pointHistory = data || [];

    // 타임라인 표시
    displayTimeline();

    // 통계 업데이트
    updateStatistics();

    // 요약 카드 업데이트
    updateSummaryCards();
  } catch (error) {
    console.error('데이터 로드 실패:', error);
    showError('데이터를 불러올 수 없습니다.');
  } finally {
    showLoading(false);
  }
}

// ==================== 타임라인 표시 ====================
function displayTimeline() {
  const container = document.getElementById('timelineContainer');

  if (pointHistory.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <p>선택한 기간에 포인트 지급 내역이 없습니다.</p>
            </div>
        `;
    return;
  }

  // 날짜별 그룹핑
  const groupedByDate = groupByDate(pointHistory);

  let html = '';

  Object.entries(groupedByDate).forEach(([date, items], index) => {
    const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const isToday = isDateToday(new Date(date));

    html += `
            <div class="day-group ${index > 2 ? 'collapsed' : ''}">
                <div class="day-header" onclick="toggleDayGroup(this)">
                    <span class="day-date">${formatDate(date)} ${
      isToday ? '(오늘)' : ''
    }</span>
                    <span class="day-summary">총 ${dayTotal.toLocaleString()}P / ${
      items.length
    }건</span>
                    <button class="btn-expand">▼</button>
                </div>
                ${items.map((item) => createTimelineItem(item)).join('')}
            </div>
        `;
  });

  container.innerHTML = html;
}

function createTimelineItem(item) {
  const time = new Date(item.created_at).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isDuplicate = checkDuplicate(item);
  const itemClass = isDuplicate ? 'warning' : '';

  // 일괄 지급 체크
  if (item.batch_id) {
    return `
            <div class="timeline-item ${itemClass}">
                <div class="time-marker">${time}</div>
                <div class="timeline-content batch-item">
                    <div class="item-header">
                        <span class="item-type">📚 ${item.reason}</span>
                        <span class="item-badge badge-success">일괄지급</span>
                    </div>
                    <div class="item-details">
                        <span>${item.batch_count}명 × ${item.amount}P = ${(
      item.batch_count * item.amount
    ).toLocaleString()}P</span>
                        <button class="btn-detail-view" onclick="showBatchDetail('${
                          item.batch_id
                        }')">상세보기</button>
                    </div>
                </div>
            </div>
        `;
  }

  // 개별 지급
  return `
        <div class="timeline-item ${itemClass}" data-id="${
    item.transaction_id
  }">
            <div class="time-marker">${time}</div>
            <div class="timeline-content individual-item">
                <div class="item-header">
                    <span class="student-name">${
                      item.students?.name || '알 수 없음'
                    }</span>
                    <span class="point-amount ${
                      item.amount < 0 ? 'negative' : ''
                    }">${item.amount > 0 ? '+' : ''}${item.amount}P</span>
                </div>
                <div class="item-details">
                    <span class="point-reason">${getReasonEmoji(item.reason)} ${
    item.reason
  }</span>
                    <div class="item-actions">
                        ${
                          canEdit(item)
                            ? `
                            <button class="btn-edit" onclick="editPoint('${item.transaction_id}')" title="수정">✏️</button>
                            <button class="btn-cancel" onclick="cancelPoint('${item.transaction_id}')" title="취소">❌</button>
                        `
                            : ''
                        }
                    </div>
                </div>
                ${
                  isDuplicate
                    ? `
                    <div class="warning-message">
                        ⚠️ ${isDuplicate.message}
                    </div>
                `
                    : ''
                }
            </div>
        </div>
    `;
}

// ==================== 중복 체크 ====================
function checkDuplicate(item) {
  const recentItems = pointHistory.filter((p) => {
    const timeDiff = new Date(item.created_at) - new Date(p.created_at);
    return (
      p.student_id === item.student_id &&
      p.transaction_id !== item.transaction_id &&
      Math.abs(timeDiff) < 30 * 60 * 1000
    ); // 30분 이내
  });

  const duplicate = recentItems.find(
    (p) => p.amount === item.amount && p.reason === item.reason
  );

  if (duplicate) {
    return {
      message: '30분 이내 동일한 지급 내역이 있습니다',
      item: duplicate,
    };
  }

  return null;
}

// ==================== 미지급 학생 관리 ====================
async function showUnpaidStudents() {
  const panel = document.getElementById('unpaidPanel');
  panel.classList.add('active');

  // 오늘 지급 받은 학생 목록
  const todayPaidStudents = new Set(
    pointHistory
      .filter((p) => isDateToday(new Date(p.created_at)))
      .map((p) => p.student_id)
  );

  // 미지급 학생 필터링
  const unpaidStudents = classStudents.filter(
    (s) => !todayPaidStudents.has(s.student_id)
  );

  // 미지급 학생 목록 표시
  const grid = document.getElementById('unpaidGrid');

  if (unpaidStudents.length === 0) {
    grid.innerHTML =
      '<p style="text-align: center; color: #6b7280;">모든 학생이 오늘 포인트를 받았습니다! 🎉</p>';
    return;
  }

  grid.innerHTML = unpaidStudents
    .map(
      (student) => `
        <div class="unpaid-student">
            <span class="unpaid-student-name">${student.name}</span>
            <div class="unpaid-student-actions">
                <button class="btn-quick-pay" onclick="quickPay('${student.login_id}', 10)">+10P</button>
                <button class="btn-quick-pay" onclick="quickPay('${student.login_id}', 20)">+20P</button>
            </div>
        </div>
    `
    )
    .join('');

  // 미지급 카운트 업데이트
  document.getElementById('unpaidCount').textContent = unpaidStudents.length;
  document.getElementById('unpaidBadge').textContent = unpaidStudents.length;
}

function closeUnpaidPanel() {
  document.getElementById('unpaidPanel').classList.remove('active');
}

// ==================== 빠른 포인트 지급 ====================
async function quickPay(loginId, amount) {
  try {
    const result = await api.addPoints(loginId, amount, '출석');

    if (result.success) {
      showNotification(`${amount}P 지급 완료!`, 'success');

      // 데이터 새로고침
      await loadData();

      // 미지급 패널 업데이트
      await showUnpaidStudents();
    } else {
      showNotification('포인트 지급 실패', 'error');
    }
  } catch (error) {
    console.error('포인트 지급 오류:', error);
    showNotification('오류가 발생했습니다', 'error');
  }
}

// 일괄 출석 처리
async function batchAttendance() {
  const unpaidStudents = classStudents.filter((s) => {
    const todayPoints = pointHistory.filter(
      (p) =>
        p.student_id === s.student_id && isDateToday(new Date(p.created_at))
    );
    return todayPoints.length === 0;
  });

  if (unpaidStudents.length === 0) {
    showNotification('모든 학생이 이미 출석 처리되었습니다', 'info');
    return;
  }

  if (
    !confirm(
      `${unpaidStudents.length}명의 학생에게 출석 포인트 10P를 지급하시겠습니까?`
    )
  ) {
    return;
  }

  let successCount = 0;
  const batchId = 'BATCH_' + Date.now();

  for (const student of unpaidStudents) {
    try {
      const result = await api.addPoints(student.login_id, 10, '출석');
      if (result.success) successCount++;
    } catch (error) {
      console.error(`${student.name} 포인트 지급 실패:`, error);
    }
  }

  showNotification(`${successCount}명 출석 처리 완료!`, 'success');
  closeUnpaidPanel();
  await loadData();
}

// ==================== 포인트 취소/수정 ====================
function canEdit(item) {
  const timeDiff = Date.now() - new Date(item.created_at).getTime();
  return timeDiff < 5 * 60 * 1000; // 5분 이내만 수정 가능
}

async function cancelPoint(transactionId) {
  if (!confirm('이 포인트 지급을 취소하시겠습니까?')) return;

  try {
    const { error } = await supabase
      .from('points')
      .delete()
      .eq('transaction_id', transactionId);

    if (error) throw error;

    showNotification('포인트 지급이 취소되었습니다', 'success');
    await loadData();
  } catch (error) {
    console.error('포인트 취소 실패:', error);
    showNotification('취소할 수 없습니다', 'error');
  }
}

// ==================== 통계 및 요약 ====================
function updateSummaryCards() {
  // 오늘 통계
  const todayData = pointHistory.filter((p) =>
    isDateToday(new Date(p.created_at))
  );
  const todayTotal = todayData.reduce((sum, p) => sum + p.amount, 0);
  const todayStudents = new Set(todayData.map((p) => p.student_id)).size;

  document.getElementById('todayTotal').textContent =
    todayTotal.toLocaleString() + 'P';
  document.getElementById(
    'todaySummary'
  ).textContent = `${todayStudents}명 완료`;

  // 주간 통계
  const weekData = pointHistory.filter((p) =>
    isThisWeek(new Date(p.created_at))
  );
  const weekTotal = weekData.reduce((sum, p) => sum + p.amount, 0);
  const weekDays = 5; // 평일만
  const weekAverage = Math.round(weekTotal / weekDays);

  document.getElementById('weekTotal').textContent =
    weekTotal.toLocaleString() + 'P';
  document.getElementById(
    'weekAverage'
  ).textContent = `평균 ${weekAverage.toLocaleString()}P/일`;

  // 최근 지급
  if (pointHistory.length > 0) {
    const lastPoint = pointHistory[0];
    const timeAgo = getTimeAgo(new Date(lastPoint.created_at));
    document.getElementById('lastPointTime').textContent = timeAgo;
    document.getElementById('lastPointInfo').textContent = `${
      lastPoint.students?.name || '알 수 없음'
    } ${lastPoint.amount}P`;
  }

  // 미지급 학생
  updateUnpaidCount();
}

async function updateUnpaidCount() {
  if (!currentClass) {
    document.getElementById('unpaidStudents').textContent = '-';
    return;
  }

  const todayPaidStudents = new Set(
    pointHistory
      .filter((p) => isDateToday(new Date(p.created_at)))
      .map((p) => p.student_id)
  );

  const unpaidCount = classStudents.filter(
    (s) => !todayPaidStudents.has(s.student_id)
  ).length;

  document.getElementById('unpaidStudents').textContent = unpaidCount + '명';
  document.getElementById('unpaidCount').textContent = unpaidCount;
  document.getElementById('unpaidBadge').textContent = unpaidCount;
  document.getElementById('todayPaidCount').textContent =
    classStudents.length - unpaidCount;
}

function updateStatistics() {
  // 최다 지급 학생
  const studentPoints = {};
  pointHistory.forEach((p) => {
    const name = p.students?.name || '알 수 없음';
    studentPoints[name] = (studentPoints[name] || 0) + p.amount;
  });

  const topStudent = Object.entries(studentPoints).sort(
    (a, b) => b[1] - a[1]
  )[0];

  if (topStudent) {
    document.getElementById('topStudent').textContent = `${
      topStudent[0]
    } (${topStudent[1].toLocaleString()}P)`;
  }

  // 평균 일일 지급
  const dailyTotals = {};
  pointHistory.forEach((p) => {
    const date = new Date(p.created_at).toDateString();
    dailyTotals[date] = (dailyTotals[date] || 0) + p.amount;
  });

  const dailyAverage =
    Object.values(dailyTotals).length > 0
      ? Math.round(
          Object.values(dailyTotals).reduce((a, b) => a + b, 0) /
            Object.values(dailyTotals).length
        )
      : 0;

  document.getElementById('dailyAverage').textContent =
    dailyAverage.toLocaleString() + 'P';

  // 주요 지급 사유
  const reasons = {};
  pointHistory.forEach((p) => {
    reasons[p.reason] = (reasons[p.reason] || 0) + 1;
  });

  const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];

  if (topReason) {
    const percentage = Math.round((topReason[1] / pointHistory.length) * 100);
    document.getElementById(
      'topReason'
    ).textContent = `${topReason[0]} (${percentage}%)`;
  }
}

// ==================== 이벤트 리스너 ====================
function setupEventListeners() {
  // 반 선택
  document
    .getElementById('classSelector')
    .addEventListener('change', async (e) => {
      currentClass = e.target.value;
      sessionStorage.setItem('selectedClass', currentClass);
      showClassInfo(currentClass);
      await loadData();
    });

  // 날짜 필터
  document.querySelectorAll('.date-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document
        .querySelectorAll('.date-btn')
        .forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');

      const range = e.target.dataset.range;
      if (range === 'custom') {
        showDateModal();
      } else {
        currentDateRange = range;
        loadData();
      }
    });
  });

  // 학생 검색
  let searchTimeout;
  document.getElementById('studentSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchStudents(e.target.value);
    }, 300);
  });

  // (이어서) assets/js/point-history.js

  // 학생 필터 탭
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      document
        .querySelectorAll('.filter-tab')
        .forEach((t) => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      filterTimeline(currentFilter);
    });
  });
}

// ==================== 검색 기능 ====================
async function searchStudents(query) {
  const dropdown = document.getElementById('searchResults');

  if (!query) {
    dropdown.classList.remove('active');
    return;
  }

  try {
    let searchQuery = supabase
      .from('student_details')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(10);

    if (currentClass) {
      searchQuery = searchQuery.eq('class_id', currentClass);
    }

    const { data: students, error } = await searchQuery;

    if (error) throw error;

    if (students.length > 0) {
      dropdown.innerHTML = students
        .map((student) => {
          const todayPoints = pointHistory.filter(
            (p) =>
              p.student_id === student.student_id &&
              isDateToday(new Date(p.created_at))
          );

          const status =
            todayPoints.length > 0
              ? `오늘 ${todayPoints.reduce(
                  (sum, p) => sum + p.amount,
                  0
                )}P 지급`
              : '오늘 미지급';

          return `
                   <div class="search-result-item" onclick="selectStudent('${student.student_id}', '${student.name}')">
                       <span>${student.name}</span>
                       <span class="search-result-status">${status}</span>
                   </div>
               `;
        })
        .join('');

      dropdown.classList.add('active');
    } else {
      dropdown.innerHTML =
        '<div class="search-result-item">검색 결과가 없습니다</div>';
      dropdown.classList.add('active');
    }
  } catch (error) {
    console.error('학생 검색 실패:', error);
  }
}

function selectStudent(studentId, studentName) {
  document.getElementById('studentSearch').value = studentName;
  document.getElementById('searchResults').classList.remove('active');

  // 해당 학생의 포인트 내역만 필터링
  const studentHistory = pointHistory.filter((p) => p.student_id === studentId);

  if (studentHistory.length > 0) {
    displayFilteredTimeline(studentHistory);
  } else {
    showNotification('해당 학생의 포인트 내역이 없습니다', 'info');
  }
}

// ==================== 필터링 ====================
function filterTimeline(filter) {
  let filteredHistory = [...pointHistory];

  switch (filter) {
    case 'paid':
      // 오늘 지급받은 학생들의 내역만
      filteredHistory = filteredHistory.filter((p) =>
        isDateToday(new Date(p.created_at))
      );
      break;

    case 'unpaid':
      // 미지급 학생 목록 표시
      showUnpaidStudents();
      return;

    case 'duplicate':
      // 중복 의심 내역만
      filteredHistory = filteredHistory.filter((p) => checkDuplicate(p));
      break;
  }

  displayFilteredTimeline(filteredHistory);
}

function displayFilteredTimeline(data) {
  const container = document.getElementById('timelineContainer');

  if (data.length === 0) {
    container.innerHTML = `
           <div class="empty-state">
               <p>필터 조건에 맞는 내역이 없습니다.</p>
           </div>
       `;
    return;
  }

  // 기존 타임라인 표시 로직 재사용
  const groupedByDate = groupByDate(data);

  let html = '';

  Object.entries(groupedByDate).forEach(([date, items]) => {
    const dayTotal = items.reduce((sum, item) => sum + item.amount, 0);

    html += `
           <div class="day-group">
               <div class="day-header" onclick="toggleDayGroup(this)">
                   <span class="day-date">${formatDate(date)}</span>
                   <span class="day-summary">총 ${dayTotal.toLocaleString()}P / ${
      items.length
    }건</span>
                   <button class="btn-expand">▼</button>
               </div>
               ${items.map((item) => createTimelineItem(item)).join('')}
           </div>
       `;
  });

  container.innerHTML = html;
}

// ==================== 중복 체크 ====================
async function checkDuplicates() {
  const duplicates = [];

  pointHistory.forEach((item) => {
    const duplicate = checkDuplicate(item);
    if (duplicate) {
      duplicates.push({
        ...item,
        duplicate: duplicate,
      });
    }
  });

  if (duplicates.length === 0) {
    showNotification('중복 의심 내역이 없습니다', 'success');
    return;
  }

  // 중복 내역만 표시
  displayFilteredTimeline(duplicates);
  showNotification(
    `${duplicates.length}건의 중복 의심 내역을 발견했습니다`,
    'warning'
  );
}

// ==================== 날짜 선택 모달 ====================
function showDateModal() {
  const modal = document.getElementById('dateModal');

  // 기본값 설정 (오늘 기준 1주일)
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);

  document.getElementById('startDate').value = weekAgo
    .toISOString()
    .split('T')[0];
  document.getElementById('endDate').value = today.toISOString().split('T')[0];

  modal.classList.add('active');
}

function closeDateModal() {
  document.getElementById('dateModal').classList.remove('active');
}

function applyDateRange() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  if (!startDate || !endDate) {
    showNotification('날짜를 선택해주세요', 'error');
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showNotification('시작일이 종료일보다 늦을 수 없습니다', 'error');
    return;
  }

  currentDateRange = { start: startDate, end: endDate };
  closeDateModal();
  loadData();
}

// ==================== 엑셀 다운로드 ====================
async function exportToExcel() {
  try {
    // 데이터 준비
    const exportData = pointHistory.map((item) => ({
      날짜: new Date(item.created_at).toLocaleDateString('ko-KR'),
      시간: new Date(item.created_at).toLocaleTimeString('ko-KR'),
      학생명: item.students?.name || '알 수 없음',
      반: item.students?.class_id || '-',
      포인트: item.amount,
      사유: item.reason,
      교사: item.teacher_id || '-',
    }));

    // CSV 생성 (간단한 방법)
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map((row) => headers.map((h) => row[h]).join(',')),
    ].join('\n');

    // 다운로드
    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `포인트지급내역_${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('엑셀 파일이 다운로드되었습니다', 'success');
  } catch (error) {
    console.error('엑셀 다운로드 실패:', error);
    showNotification('다운로드에 실패했습니다', 'error');
  }
}

// ==================== 유틸리티 함수 ====================
function getDateRange(range) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let startDate, endDate;

  switch (range) {
    case 'today':
      startDate = today;
      endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      break;

    case 'week':
      const monday = new Date(today);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      startDate = monday;
      endDate = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      break;

    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;

    default:
      if (typeof range === 'object' && range.start && range.end) {
        startDate = new Date(range.start);
        endDate = new Date(range.end + ' 23:59:59');
      } else {
        startDate = today;
        endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
  }

  // 날짜 범위 표시
  document.getElementById(
    'currentDateRange'
  ).textContent = `${startDate.toLocaleDateString(
    'ko-KR'
  )} ~ ${endDate.toLocaleDateString('ko-KR')}`;

  return { startDate, endDate };
}

function groupByDate(data) {
  const grouped = {};

  data.forEach((item) => {
    const date = new Date(item.created_at).toDateString();
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(item);
  });

  return grouped;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  };
  return date.toLocaleDateString('ko-KR', options);
}

function isDateToday(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isThisWeek(date) {
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return date >= startOfWeek && date <= endOfWeek;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  const intervals = {
    년: 31536000,
    개월: 2592000,
    일: 86400,
    시간: 3600,
    분: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval}${unit} 전`;
    }
  }

  return '방금 전';
}

function getReasonEmoji(reason) {
  const emojis = {
    출석: '📚',
    숙제: '📝',
    발표: '🎤',
    시험: '📊',
    특별: '⭐',
    벌금: '⚠️',
    기타: '💡',
  };

  for (const [key, emoji] of Object.entries(emojis)) {
    if (reason.includes(key)) return emoji;
  }

  return '📌';
}

function toggleDayGroup(header) {
  const group = header.parentElement;
  group.classList.toggle('collapsed');
}

// ==================== UI 헬퍼 ====================
function showLoading(show) {
  const container = document.getElementById('timelineContainer');
  if (show) {
    container.innerHTML =
      '<div class="loading-spinner">데이터를 불러오는 중...</div>';
  }
}

function showError(message) {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = `
       <div class="error-state">
           <p>${message}</p>
           <button onclick="refreshData()">다시 시도</button>
       </div>
   `;
}

function showNotification(message, type = 'info') {
  // 간단한 토스트 알림
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  toast.style.cssText = `
       position: fixed;
       bottom: 20px;
       right: 20px;
       padding: 12px 20px;
       background: ${
         type === 'success'
           ? '#10b981'
           : type === 'error'
           ? '#ef4444'
           : type === 'warning'
           ? '#f59e0b'
           : '#6366f1'
       };
       color: white;
       border-radius: 8px;
       box-shadow: 0 4px 12px rgba(0,0,0,0.15);
       z-index: 9999;
       animation: slideInUp 0.3s ease;
   `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutDown 0.3s ease';
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}

// ==================== 새로고침 ====================
async function refreshData() {
  await loadData();
  showNotification('데이터를 새로고침했습니다', 'success');
}

// ==================== 대시보드 이동 ====================
function goToDashboard() {
  window.location.href = 'index.html';
}

// ==================== 로그아웃 ====================
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '../login.html';
  }
}

// ==================== 애니메이션 ====================
const style = document.createElement('style');
style.textContent = `
   @keyframes slideInUp {
       from {
           transform: translateY(100%);
           opacity: 0;
       }
       to {
           transform: translateY(0);
           opacity: 1;
       }
   }
   
   @keyframes slideOutDown {
       from {
           transform: translateY(0);
           opacity: 1;
       }
       to {
           transform: translateY(100%);
           opacity: 0;
       }
   }
`;
document.head.appendChild(style);

// ==================== 초기화 완료 로그 ====================
console.log('✅ 포인트 지급 관리 페이지 초기화 완료');
