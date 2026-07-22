// purchase-management-table.js - 개선된 구매 관리 기능 (테이블 뷰 포함)

// 전역 변수
let allPurchases = [];
let filteredPurchases = [];
let currentTab = 'pending';
let currentPage = 1;
let itemsPerPage = 20;
let selectedPurchase = null;
let selectedPurchases = new Set();
let currentViewMode = 'table'; // 'table' or 'card'

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('구매 관리 페이지 초기화');

  // 로그인 체크
  const loginId = localStorage.getItem('loginId');
  const userName = localStorage.getItem('userName');
  const userRole = localStorage.getItem('userRole');

  if (!loginId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 사용자 정보 표시
  document.getElementById('teacherName').textContent = userName || '선생님';
  document.getElementById('userRole').textContent =
    userRole === 'principal' ? '원장' : '선생님';

  // 관리 메뉴 권한 체크 (원장만 표시)
  if (userRole === 'principal' || loginId === 'ablemaster') {
    const adminSection = document.getElementById('adminSection');
    if (adminSection) {
      adminSection.style.display = 'block';
    }
  }

  // 초기 데이터 로드
  await loadPurchases();

  // 검색 이벤트
  document
    .getElementById('searchInput')
    .addEventListener('input', handleSearch);

  // 자동 새로고침 (30초마다)
  setInterval(refreshPurchases, 30000);

  console.log('구매 관리 페이지 초기화 완료');
});

// ==================== 뷰 모드 전환 ====================
function setViewMode(mode) {
  currentViewMode = mode;

  // 버튼 활성화 상태 변경
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });

  // 뷰 전환
  document
    .getElementById('tableView')
    .classList.toggle('active', mode === 'table');
  document
    .getElementById('cardView')
    .classList.toggle('active', mode === 'card');

  // 데이터 다시 표시
  displayPurchases();
}

// ==================== 페이지당 표시 개수 변경 ====================
function changeItemsPerPage() {
  const selector = document.getElementById('perPageSelector');
  itemsPerPage = parseInt(selector.value);
  currentPage = 1;
  displayPurchases();
  updatePagination();
}

// ==================== 데이터 로드 ====================
async function loadPurchases() {
  try {
    showLoading();

    const result = await api.getAllPurchases();

    if (result.success && result.data) {
      allPurchases = result.data;
      console.log(`실제 구매 내역 ${allPurchases.length}건 로드 완료`);

      updateStatistics();
      filterAndDisplayPurchases();
    } else {
      console.error('구매 내역 로드 실패:', result.error);
      // loadDummyData() 대신 빈 배열 사용
      allPurchases = [];
      updateStatistics();
      filterAndDisplayPurchases();
    }
  } catch (error) {
    console.error('구매 내역 로드 오류:', error);
    // loadDummyData() 대신 에러 처리
    showError('데이터를 불러올 수 없습니다.');
  }
}

// loadDummyData 함수 추가 (없으므로)
function loadDummyData() {
  console.log('더미 데이터 사용');
  allPurchases = generateDummyData();
  updateStatistics();
  filterAndDisplayPurchases();
}

// 테스트용 더미 데이터 생성
function generateDummyData() {
  const items = [
    '츄파춥스',
    '초코파이',
    '아이스크림',
    '삼각김밥',
    '컵라면',
    '문화상품권',
    '에어팟',
    '연필',
    '공책',
  ];
  const classes = [
    '초등 월수 1반',
    '초등 화목 2반',
    '중등 월수 1반',
    '중등 화목 3반',
  ];
  const students = [
    '김민준',
    '이서연',
    '박지호',
    '최유진',
    '정예준',
    '강민서',
    '조은우',
    '윤서진',
    '임하준',
    '한지우',
  ];

  const data = [];
  for (let i = 0; i < 150; i++) {
    const isPending = Math.random() > 0.6;
    const createdAt = new Date(
      Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
    );

    data.push({
      transaction_id: `T${1000 + i}`,
      student_id: `S${100 + Math.floor(Math.random() * 50)}`,
      studentName: students[Math.floor(Math.random() * students.length)],
      studentClass: classes[Math.floor(Math.random() * classes.length)],
      studentAvatar: ['🦁', '🐰', '🐻', '🐼', '🦊'][
        Math.floor(Math.random() * 5)
      ],
      item_name: items[Math.floor(Math.random() * items.length)],
      amount: Math.floor(Math.random() * 50 + 10) * 100,
      created_at: createdAt.toISOString(),
      delivery_status: isPending ? 'pending' : 'delivered',
      delivered_at: isPending
        ? null
        : new Date(
            createdAt.getTime() + Math.random() * 2 * 60 * 60 * 1000
          ).toISOString(),
      delivered_by: isPending ? null : '김선생님',
    });
  }

  return data;
}

// ==================== 통계 업데이트 ====================
function updateStatistics() {
  const pendingCount = allPurchases.filter(
    (p) => p.delivery_status === 'pending'
  ).length;
  const todayDelivered = allPurchases.filter((p) => {
    return p.delivery_status === 'delivered' && isToday(p.delivered_at);
  }).length;

  document.getElementById('pendingCount').textContent = pendingCount;
  document.getElementById('todayCount').textContent = todayDelivered;
  document.getElementById('pendingBadge').textContent = pendingCount;
  document.getElementById('pendingBadge2').textContent = pendingCount;

  // 미지급 배지 표시/숨기기
  const badge = document.getElementById('pendingBadge');
  if (badge) {
    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
}

// ==================== 필터링 및 표시 ====================
function showTab(tab) {
  currentTab = tab;
  currentPage = 1;
  selectedPurchases.clear();
  updateBulkActionBar();

  // 탭 버튼 활성화
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  filterAndDisplayPurchases();
}

function filterAndDisplayPurchases() {
  let filtered = [...allPurchases];

  // 탭별 필터링
  switch (currentTab) {
    case 'pending':
      filtered = filtered.filter((p) => p.delivery_status === 'pending');
      break;
    case 'delivered':
      filtered = filtered.filter((p) => p.delivery_status === 'delivered');
      break;
  }

  // 검색어 필터링
  const searchTerm = document
    .getElementById('searchInput')
    .value.toLowerCase()
    .trim();
  if (searchTerm) {
    filtered = filtered.filter(
      (p) =>
        (p.studentName && p.studentName.toLowerCase().includes(searchTerm)) ||
        (p.item_name && p.item_name.toLowerCase().includes(searchTerm))
    );
  }

  // 정렬
  if (currentTab === 'pending') {
    filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else {
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  filteredPurchases = filtered;
  displayPurchases();
  updatePagination();
}

function handleSearch() {
  currentPage = 1;
  filterAndDisplayPurchases();
}

// ==================== 테이블 뷰 표시 ====================
function displayPurchases() {
  if (currentViewMode === 'table') {
    displayTableView();
  } else {
    displayCardView();
  }
  updatePaginationInfo();
}

function displayTableView() {
  const tbody = document.getElementById('purchaseTableBody');

  if (filteredPurchases.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: #9ca3af;">
          ${
            currentTab === 'pending'
              ? '미지급 구매가 없습니다'
              : currentTab === 'delivered'
              ? '지급 완료된 구매가 없습니다'
              : '구매 내역이 없습니다'
          }
        </td>
      </tr>
    `;
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = filteredPurchases.slice(startIndex, endIndex);

  tbody.innerHTML = pageItems
    .map((purchase) => {
      const isPending = purchase.delivery_status === 'pending';
      const hoursElapsed = getHoursElapsed(purchase.created_at);
      const isUrgent = isPending && hoursElapsed >= 1;
      const isSelected = selectedPurchases.has(purchase.transaction_id);

      return `
      <tr class="${isSelected ? 'selected' : ''}" data-id="${
        purchase.transaction_id
      }">
        <td>
          <input type="checkbox" 
                 class="purchase-checkbox" 
                 data-id="${purchase.transaction_id}"
                 ${isSelected ? 'checked' : ''}
                 ${!isPending ? 'disabled' : ''}
                 onchange="togglePurchaseSelection('${
                   purchase.transaction_id
                 }')">
        </td>
        <td>
          <span class="status-badge ${
            isPending ? (isUrgent ? 'urgent' : 'pending') : 'delivered'
          }">
            ${isPending ? (isUrgent ? '🚨 긴급' : '⏳ 대기중') : '✅ 완료'}
          </span>
        </td>
        <td>
          <div class="student-cell">
            <div class="student-avatar-small">${purchase.studentAvatar}</div>
            <span class="student-name-small">${purchase.studentName}</span>
          </div>
        </td>
        <td>${purchase.studentClass}</td>
        <td><strong>${purchase.item_name}</strong></td>
        <td class="price-cell">${purchase.amount.toLocaleString()}P</td>
        <td class="time-cell">${formatShortDateTime(purchase.created_at)}</td>
        <td class="${isUrgent ? 'elapsed-urgent' : 'time-cell'}">
          ${formatElapsedTime(purchase.created_at)}
        </td>
        <td>
          <div class="action-buttons">
            ${
              isPending
                ? `
              <button class="btn-action btn-deliver-small" 
                      onclick="showDeliveryModal('${purchase.transaction_id}')">
                지급
              </button>
            `
                : ''
            }
            <button class="btn-action" onclick="showDetailModal('${
              purchase.transaction_id
            }')">
              상세
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

// ==================== 카드 뷰 표시 (기존 스타일) ====================
function displayCardView() {
  const container = document.getElementById('purchaseList');

  if (filteredPurchases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">
          ${
            currentTab === 'pending'
              ? '미지급 구매가 없습니다'
              : currentTab === 'delivered'
              ? '지급 완료된 구매가 없습니다'
              : '구매 내역이 없습니다'
          }
        </div>
      </div>
    `;
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = filteredPurchases.slice(startIndex, endIndex);

  container.innerHTML = pageItems
    .map((purchase) => createPurchaseCard(purchase))
    .join('');
}

function createPurchaseCard(purchase) {
  const isPending = purchase.delivery_status === 'pending';
  const hoursElapsed = getHoursElapsed(purchase.created_at);
  const isUrgent = isPending && hoursElapsed >= 1;

  return `
    <div class="purchase-card ${
      isPending ? (isUrgent ? 'urgent' : 'pending') : 'delivered'
    }">
      ${isUrgent ? '<div class="urgent-indicator">⏰ 긴급</div>' : ''}
      
      <div class="card-header">
        <div class="student-info">
          <div class="student-avatar">${purchase.studentAvatar}</div>
          <div class="student-details">
            <div class="student-name">${purchase.studentName}</div>
            <div class="student-class">${purchase.studentClass}</div>
          </div>
        </div>
        <div class="status-info">
          <span class="status-badge ${isPending ? 'pending' : 'delivered'}">
            ${isPending ? '🔸 미지급' : '✅ 지급완료'}
          </span>
        </div>
      </div>

      <div class="item-info">
        <div class="item-name">${purchase.item_name}</div>
        <div class="item-price">${purchase.amount.toLocaleString()}P</div>
      </div>

      <div class="time-info">
        <div>구매: ${formatDateTime(purchase.created_at)}</div>
        <div>경과: ${formatElapsedTime(purchase.created_at)}</div>
      </div>

      <div class="card-actions">
        ${
          isPending
            ? `
          <button class="btn-deliver" onclick="showDeliveryModal('${purchase.transaction_id}')">
            🎁 지급완료
          </button>
        `
            : ''
        }
        <button class="btn-detail" onclick="showDetailModal('${
          purchase.transaction_id
        }')">
          📋 상세보기
        </button>
      </div>
    </div>
  `;
}

// ==================== 선택 관리 ====================
function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll(
    '.purchase-checkbox:not(:disabled)'
  );

  if (selectAll.checked) {
    checkboxes.forEach((cb) => {
      cb.checked = true;
      selectedPurchases.add(cb.dataset.id);
    });
  } else {
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
    selectedPurchases.clear();
  }

  updateBulkActionBar();
}

function togglePurchaseSelection(id) {
  if (selectedPurchases.has(id)) {
    selectedPurchases.delete(id);
  } else {
    selectedPurchases.add(id);
  }

  // 해당 행 선택 표시
  const row = document.querySelector(`tr[data-id="${id}"]`);
  if (row) {
    row.classList.toggle('selected', selectedPurchases.has(id));
  }

  // 전체 선택 체크박스 상태 업데이트
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll(
    '.purchase-checkbox:not(:disabled)'
  );
  selectAll.checked =
    checkboxes.length > 0 && Array.from(checkboxes).every((cb) => cb.checked);

  updateBulkActionBar();
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionBar');
  const count = selectedPurchases.size;

  if (count > 0) {
    bar.style.display = 'flex';
    document.getElementById('selectedCount').textContent = count;
  } else {
    bar.style.display = 'none';
  }
}

function cancelSelection() {
  selectedPurchases.clear();
  document
    .querySelectorAll('.purchase-checkbox')
    .forEach((cb) => (cb.checked = false));
  document
    .querySelectorAll('tr.selected')
    .forEach((row) => row.classList.remove('selected'));
  document.getElementById('selectAll').checked = false;
  updateBulkActionBar();
}

// ==================== 일괄 처리 ====================
async function bulkDeliver() {
  const ids = Array.from(selectedPurchases);
  if (ids.length === 0) return;

  if (!confirm(`선택한 ${ids.length}개 상품을 지급 처리하시겠습니까?`)) {
    return;
  }

  const teacherId = localStorage.getItem('loginId');
  const teacherName = localStorage.getItem('userName');

  try {
    // 선택된 각 항목을 실제로 지급 처리
    const results = await Promise.all(
      ids.map((id) => api.markAsDelivered(id, teacherId, teacherName, ''))
    );

    const failed = results.filter((r) => !r || !r.success);
    const successCount = results.length - failed.length;

    if (failed.length === 0) {
      alert(`${successCount}개 상품이 지급 처리되었습니다.`);
    } else {
      console.error('일괄 지급 실패 항목:', failed);
      alert(
        `${successCount}개 처리 완료, ${failed.length}개 실패했습니다.\n` +
          '실패한 항목은 목록에 그대로 남아있습니다.'
      );
    }

    // 초기화
    cancelSelection();
    await loadPurchases();
  } catch (error) {
    console.error('일괄 지급 처리 오류:', error);
    alert('일괄 지급 처리 중 오류가 발생했습니다.');
  }
}

// ==================== 페이지네이션 ====================
function updatePagination() {
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const pagination = document.getElementById('pagination');

  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';

  // 이전 페이지
  if (currentPage > 1) {
    html += `<button class="page-btn" onclick="changePage(${
      currentPage - 1
    })">‹</button>`;
  }

  // 페이지 번호 계산
  const maxButtons = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  // 첫 페이지
  if (startPage > 1) {
    html += `<button class="page-btn" onclick="changePage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span class="page-dots">...</span>`;
    }
  }

  // 페이지 번호들
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
             onclick="changePage(${i})">${i}</button>`;
  }

  // 마지막 페이지
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="page-dots">...</span>`;
    }
    html += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
  }

  // 다음 페이지
  if (currentPage < totalPages) {
    html += `<button class="page-btn" onclick="changePage(${
      currentPage + 1
    })">›</button>`;
  }

  pagination.innerHTML = html;
}

function updatePaginationInfo() {
  const total = filteredPurchases.length;
  const start = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const end = Math.min(currentPage * itemsPerPage, total);

  document.getElementById('totalItems').textContent = total;
  document.getElementById('showingRange').textContent = `${start}-${end}`;
}

function changePage(page) {
  currentPage = page;
  selectedPurchases.clear();
  document.getElementById('selectAll').checked = false;
  updateBulkActionBar();
  displayPurchases();
  updatePagination();

  // 페이지 상단으로 스크롤
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== 모달 관리 ====================
function showDeliveryModal(purchaseId) {
  const purchase = filteredPurchases.find(
    (p) => p.transaction_id === purchaseId
  );
  if (!purchase) return;

  selectedPurchase = purchase;

  document.getElementById('modalStudentName').textContent =
    purchase.studentName;
  document.getElementById('modalStudentClass').textContent =
    purchase.studentClass;
  document.getElementById('modalStudentAvatar').textContent =
    purchase.studentAvatar;
  document.getElementById('modalItemName').textContent = purchase.item_name;
  document.getElementById(
    'modalItemPrice'
  ).textContent = `${purchase.amount.toLocaleString()}P`;
  document.getElementById('modalPurchaseTime').textContent = formatDateTime(
    purchase.created_at
  );
  document.getElementById('modalElapsedTime').textContent = formatElapsedTime(
    purchase.created_at
  );
  document.getElementById('deliveryNotes').value = '';

  document.getElementById('deliveryModal').classList.add('active');
}

function closeDeliveryModal() {
  document.getElementById('deliveryModal').classList.remove('active');
  selectedPurchase = null;
}

// confirmDelivery 함수에서 toastr 대신 alert 사용
async function confirmDelivery() {
  if (!selectedPurchase) return;

  const confirmBtn = document.getElementById('confirmDeliveryBtn');
  const originalText = confirmBtn.textContent;

  try {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '처리 중...';

    const notes = document.getElementById('deliveryNotes').value.trim();
    const teacherId = localStorage.getItem('loginId');
    const teacherName = localStorage.getItem('userName');

    const result = await api.markAsDelivered(
      selectedPurchase.transaction_id,
      teacherId,
      teacherName,
      notes
    );

    if (result.success) {
      // toastr 대신 alert 사용
      alert(
        `${selectedPurchase.studentName}님의 ${selectedPurchase.item_name} 지급이 완료되었습니다.`
      );

      closeDeliveryModal();
      await loadPurchases();
    } else {
      alert('지급 처리에 실패했습니다: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('지급 처리 오류:', error);
    alert('지급 처리 중 오류가 발생했습니다.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;
  }
}

// ==================== 상세보기 모달 ====================
function showDetailModal(purchaseId) {
  const purchase = filteredPurchases.find(
    (p) => p.transaction_id === purchaseId
  );

  if (!purchase) {
    console.error('구매 정보를 찾을 수 없습니다:', purchaseId);
    return;
  }

  // 현재 선택된 구매 정보 저장 (지급처리용)
  selectedPurchase = purchase;

  // 학생 정보
  document.getElementById('detailStudentName').textContent =
    purchase.studentName;
  document.getElementById('detailStudentClass').textContent =
    purchase.studentClass;
  document.getElementById('detailStudentAvatar').textContent =
    purchase.studentAvatar || '🦁';
  document.getElementById('detailStudentId').textContent = purchase.student_id;

  // 상품 정보
  document.getElementById('detailItemName').textContent = purchase.item_name;
  document.getElementById(
    'detailItemPrice'
  ).textContent = `${purchase.amount.toLocaleString()}P`;

  // 구매 정보
  document.getElementById('detailTransactionId').textContent =
    purchase.transaction_id;
  document.getElementById('detailPurchaseTime').textContent = formatDateTime(
    purchase.created_at
  );
  document.getElementById('detailElapsedTime').textContent = formatElapsedTime(
    purchase.created_at
  );

  // 지급 정보 표시/숨김
  const isPending = purchase.delivery_status === 'pending';
  const deliveryInfoGroup = document.getElementById('deliveryInfoGroup');
  const detailDeliverBtn = document.getElementById('detailDeliverBtn');

  if (isPending) {
    // 미지급인 경우
    deliveryInfoGroup.style.display = 'none';
    detailDeliverBtn.style.display = 'inline-block';
  } else {
    // 지급완료인 경우
    deliveryInfoGroup.style.display = 'block';
    detailDeliverBtn.style.display = 'none';

    // 지급 정보 표시
    document.getElementById('detailDeliveredBy').textContent =
      purchase.delivered_by || '-';
    document.getElementById('detailDeliveredAt').textContent =
      purchase.delivered_at ? formatDateTime(purchase.delivered_at) : '-';

    // 지급 메모 (있는 경우만 표시)
    const notesRow = document.getElementById('deliveryNotesRow');
    if (purchase.delivery_notes) {
      notesRow.style.display = 'flex';
      document.getElementById('detailDeliveryNotes').textContent =
        purchase.delivery_notes;
    } else {
      notesRow.style.display = 'none';
    }
  }

  // 모달 열기
  document.getElementById('detailModal').classList.add('active');
}

// 상세보기 모달 닫기
function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
  selectedPurchase = null;
}

// 상세보기에서 지급처리
function deliverFromDetail() {
  if (!selectedPurchase) return;

  // 상세보기 모달 닫고
  closeDetailModal();

  // 지급 모달 열기
  showDeliveryModal(selectedPurchase.transaction_id);
}

// ESC 키로 모달 닫기 (기존 코드 수정)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDeliveryModal();
    closeDetailModal(); // 추가
    if (typeof closeBulkDeliveryModal === 'function') {
      closeBulkDeliveryModal();
    }
  }
});

// ==================== 유틸리티 함수 ====================
function showLoading() {
  const container =
    currentViewMode === 'table'
      ? document.getElementById('purchaseTableBody')
      : document.getElementById('purchaseList');

  container.innerHTML = `
    <tr><td colspan="9" style="text-align: center; padding: 40px;">
      <div>구매 내역을 불러오는 중...</div>
    </td></tr>
  `;
}

function showError(message) {
  const container =
    currentViewMode === 'table'
      ? document.getElementById('purchaseTableBody')
      : document.getElementById('purchaseList');

  container.innerHTML = `
    <tr><td colspan="9" style="text-align: center; padding: 40px; color: #ef4444;">
      ${message}
    </td></tr>
  `;
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatElapsedTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) {
    return `${minutes}분 전`;
  } else if (hours < 24) {
    return `${hours}시간 전`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  }
}

function getHoursElapsed(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return (now - date) / (1000 * 60 * 60);
}

function isToday(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function refreshPurchases() {
  loadPurchases();
  toastr.info('목록을 새로고침했습니다.');
}

// 로그아웃
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDeliveryModal();
    closeDetailModal();
  }
});
