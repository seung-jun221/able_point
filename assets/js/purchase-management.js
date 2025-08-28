// purchase-management.js - 구매 관리 기능

// 전역 변수
let allPurchases = [];
let filteredPurchases = [];
let currentTab = 'pending';
let currentPage = 1;
let itemsPerPage = 20;
let selectedPurchase = null;

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
    userRole === 'principal' ? 'Principal' : 'Teacher';

  // 관리 메뉴 권한 체크 (원장만 표시)
  if (userRole !== 'principal' && loginId !== 'ablemaster') {
    const adminSection = document.getElementById('adminSection');
    if (adminSection) {
      adminSection.style.display = 'none';
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

// ==================== 데이터 로드 ====================

/**
 * 구매 내역 로드
 */
async function loadPurchases() {
  try {
    showLoading();

    // 구매 내역과 학생 정보를 함께 가져오기
    const [purchaseResult, studentResult] = await Promise.all([
      api.getAllPurchases(), // 새로 만들어야 하는 API 함수
      api.getAllStudents(), // 기존 API 함수
    ]);

    if (purchaseResult.success && purchaseResult.data) {
      allPurchases = purchaseResult.data;

      // 학생 정보 매핑
      if (studentResult.success && studentResult.data) {
        const studentsMap = new Map();
        studentResult.data.forEach((student) => {
          studentsMap.set(student.loginId || student.studentId, student);
        });

        allPurchases.forEach((purchase) => {
          const student = studentsMap.get(
            purchase.studentId || purchase.student_id
          );
          if (student) {
            purchase.studentName = student.name;
            purchase.studentClass = student.className || student.classId;
            purchase.studentAvatar = student.avatar || '🦁';
          }
        });
      }

      console.log(`구매 내역 ${allPurchases.length}건 로드 완료`);
    } else {
      console.error('구매 내역 로드 실패:', purchaseResult.error);
      allPurchases = [];
    }

    updateStatistics();
    filterAndDisplayPurchases();
  } catch (error) {
    console.error('구매 내역 로드 오류:', error);
    showError('구매 내역을 불러올 수 없습니다.');
  }
}

/**
 * 통계 업데이트
 */
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

  // 긴급 상태 표시 (1시간 이상 미지급)
  const urgentCount = allPurchases.filter((p) => {
    return (
      p.delivery_status === 'pending' && getHoursElapsed(p.created_at) >= 1
    );
  }).length;

  const statCard = document.querySelector('.stat-card.urgent');
  if (urgentCount > 0) {
    statCard.classList.add('blink');
  } else {
    statCard.classList.remove('blink');
  }
}

// ==================== 탭 및 필터링 ====================

/**
 * 탭 전환
 */
function showTab(tab) {
  currentTab = tab;
  currentPage = 1;

  // 탭 버튼 활성화
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  filterAndDisplayPurchases();
}

/**
 * 필터링 및 표시
 */
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
    case 'all':
      // 전체 표시
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
        (p.itemName && p.itemName.toLowerCase().includes(searchTerm)) ||
        (p.item_name && p.item_name.toLowerCase().includes(searchTerm))
    );
  }

  // 정렬 (미지급은 오래된 순, 지급완료는 최신순)
  if (currentTab === 'pending') {
    filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else {
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  filteredPurchases = filtered;
  displayPurchases();
  updatePagination();
}

/**
 * 구매 목록 표시
 */
function displayPurchases() {
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
        <div class="empty-subtitle">
          ${
            currentTab === 'pending'
              ? '새로운 구매가 있으면 여기에 표시됩니다'
              : ''
          }
        </div>
      </div>
    `;
    return;
  }

  // 페이징 처리
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = filteredPurchases.slice(startIndex, endIndex);

  container.innerHTML = pageItems
    .map((purchase) => createPurchaseCard(purchase))
    .join('');
}

/**
 * 구매 카드 생성
 */
function createPurchaseCard(purchase) {
  const isPending = purchase.delivery_status === 'pending';
  const hoursElapsed = getHoursElapsed(purchase.created_at);
  const isUrgent = isPending && hoursElapsed >= 1;

  const itemName = purchase.itemName || purchase.item_name || '알 수 없는 상품';
  const price = purchase.price || purchase.amount || 0;
  const studentName = purchase.studentName || '알 수 없는 학생';
  const studentClass = purchase.studentClass || '';

  return `
    <div class="purchase-card ${isPending ? 'pending' : 'delivered'} ${
    isUrgent ? 'urgent' : ''
  }" 
         data-id="${purchase.transaction_id || purchase.id}">
      
      ${isUrgent ? '<div class="urgent-indicator">🚨 긴급</div>' : ''}
      
      <div class="card-header">
        <div class="student-info">
          <div class="student-avatar">${purchase.studentAvatar || '🦁'}</div>
          <div class="student-details">
            <div class="student-name">${studentName}</div>
            <div class="student-class">${studentClass}</div>
          </div>
        </div>
        
        <div class="status-badge ${isPending ? 'pending' : 'delivered'}">
          ${isPending ? '🔸 미지급' : '✅ 완료'}
        </div>
      </div>

      <div class="card-body">
        <div class="item-section">
          <div class="item-image">
            ${
              purchase.image_url
                ? `<img src="${purchase.image_url}" alt="${itemName}" 
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                : ''
            }
            <span class="item-emoji" ${
              purchase.image_url ? 'style="display:none;"' : ''
            }>${getProductEmoji(itemName)}</span>
          </div>
          <div class="item-info">
            <div class="item-name">${itemName}</div>
            <div class="item-price">${Math.abs(price).toLocaleString()}P</div>
          </div>
        </div>

        <div class="time-section">
          <div class="time-info">
            <div class="purchase-time">
              📅 ${formatDateTime(purchase.created_at)}
            </div>
            <div class="elapsed-time ${isUrgent ? 'urgent' : ''}">
              ⏰ ${formatElapsedTime(purchase.created_at)}
            </div>
            ${
              !isPending
                ? `
              <div class="delivery-info">
                👤 ${purchase.delivered_by || '알 수 없음'} | 
                📅 ${formatDateTime(purchase.delivered_at)}
              </div>
            `
                : ''
            }
          </div>
        </div>
      </div>

      <div class="card-actions">
        ${
          isPending
            ? `
          <button class="btn-deliver" onclick="showDeliveryModal('${
            purchase.transaction_id || purchase.id
          }')">
            🎁 지급완료
          </button>
        `
            : ''
        }
        <button class="btn-detail" onclick="showDetailModal('${
          purchase.transaction_id || purchase.id
        }')">
          📋 상세보기
        </button>
      </div>
    </div>
  `;
}

// ==================== 지급 처리 ====================

/**
 * 지급 모달 표시
 */
function showDeliveryModal(purchaseId) {
  const purchase = allPurchases.find(
    (p) => (p.transaction_id || p.id) === purchaseId
  );

  if (!purchase) {
    toastr.error('구매 정보를 찾을 수 없습니다.');
    return;
  }

  selectedPurchase = purchase;

  // 모달 정보 설정
  document.getElementById('modalStudentName').textContent =
    purchase.studentName || '알 수 없는 학생';
  document.getElementById('modalStudentClass').textContent =
    purchase.studentClass || '';
  document.getElementById('modalStudentAvatar').textContent =
    purchase.studentAvatar || '🦁';

  const itemName = purchase.itemName || purchase.item_name || '알 수 없는 상품';
  document.getElementById('modalItemName').textContent = itemName;
  document.getElementById('modalItemPrice').textContent = `${Math.abs(
    purchase.price || purchase.amount || 0
  ).toLocaleString()}P`;

  document.getElementById('modalPurchaseTime').textContent = formatDateTime(
    purchase.created_at
  );
  document.getElementById('modalElapsedTime').textContent = formatElapsedTime(
    purchase.created_at
  );

  // 이미지 설정
  const modalImage = document.getElementById('modalItemImage');
  if (purchase.image_url) {
    modalImage.innerHTML = `<img src="${purchase.image_url}" alt="${itemName}" 
      onerror="this.parentNode.innerHTML='<span class=\\"item-emoji\\">${getProductEmoji(
        itemName
      )}</span>'">`;
  } else {
    modalImage.innerHTML = `<span class="item-emoji">${getProductEmoji(
      itemName
    )}</span>`;
  }

  // 메모 초기화
  document.getElementById('deliveryNotes').value = '';

  // 모달 표시
  document.getElementById('deliveryModal').classList.add('active');
}

/**
 * 지급 확인
 */
async function confirmDelivery() {
  if (!selectedPurchase) return;

  const confirmBtn = document.getElementById('confirmDeliveryBtn');
  const originalText = confirmBtn.textContent;

  try {
    // 버튼 로딩 상태
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="loading-spinner"></span> 처리 중...';

    const deliveryNotes = document.getElementById('deliveryNotes').value.trim();
    const teacherId = localStorage.getItem('loginId');
    const teacherName = localStorage.getItem('userName');

    const result = await api.markAsDelivered(
      selectedPurchase.transaction_id || selectedPurchase.id,
      teacherId,
      teacherName,
      deliveryNotes
    );

    if (result.success) {
      toastr.success(
        `${selectedPurchase.studentName}님의 ${
          selectedPurchase.itemName || selectedPurchase.item_name
        } 지급 처리가 완료되었습니다.`
      );

      // 모달 닫기
      closeDeliveryModal();

      // 데이터 새로고침
      await loadPurchases();
    } else {
      toastr.error(result.error || '지급 처리에 실패했습니다.');
    }
  } catch (error) {
    console.error('지급 처리 오류:', error);
    toastr.error('지급 처리 중 오류가 발생했습니다.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;
  }
}

// ==================== 모달 관리 ====================

/**
 * 지급 모달 닫기
 */
function closeDeliveryModal() {
  document.getElementById('deliveryModal').classList.remove('active');
  selectedPurchase = null;
}

/**
 * 상세 모달 표시
 */
function showDetailModal(purchaseId) {
  const purchase = allPurchases.find(
    (p) => (p.transaction_id || p.id) === purchaseId
  );

  if (!purchase) {
    toastr.error('구매 정보를 찾을 수 없습니다.');
    return;
  }

  const isPending = purchase.delivery_status === 'pending';
  const itemName = purchase.itemName || purchase.item_name || '알 수 없는 상품';

  const detailContent = `
    <div class="detail-section">
      <h3>학생 정보</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="label">이름</span>
          <span class="value">${
            purchase.studentName || '알 수 없는 학생'
          }</span>
        </div>
        <div class="detail-item">
          <span class="label">클래스</span>
          <span class="value">${purchase.studentClass || '-'}</span>
        </div>
        <div class="detail-item">
          <span class="label">학생 ID</span>
          <span class="value">${
            purchase.studentId || purchase.student_id || '-'
          }</span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>상품 정보</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="label">상품명</span>
          <span class="value">${itemName}</span>
        </div>
        <div class="detail-item">
          <span class="label">가격</span>
          <span class="value">${Math.abs(
            purchase.price || purchase.amount || 0
          ).toLocaleString()}P</span>
        </div>
        <div class="detail-item">
          <span class="label">상품 ID</span>
          <span class="value">${
            purchase.itemId || purchase.item_id || '-'
          }</span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3>구매 정보</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="label">구매 시간</span>
          <span class="value">${formatDateTime(purchase.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="label">경과 시간</span>
          <span class="value">${formatElapsedTime(purchase.created_at)}</span>
        </div>
        <div class="detail-item">
          <span class="label">상태</span>
          <span class="value status ${isPending ? 'pending' : 'delivered'}">
            ${isPending ? '🔸 미지급' : '✅ 지급완료'}
          </span>
        </div>
      </div>
    </div>

    ${
      !isPending
        ? `
      <div class="detail-section">
        <h3>지급 정보</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">지급자</span>
            <span class="value">${purchase.delivered_by || '알 수 없음'}</span>
          </div>
          <div class="detail-item">
            <span class="label">지급 시간</span>
            <span class="value">${formatDateTime(purchase.delivered_at)}</span>
          </div>
          <div class="detail-item full-width">
            <span class="label">메모</span>
            <span class="value">${purchase.delivery_notes || '없음'}</span>
          </div>
        </div>
      </div>
    `
        : ''
    }
  `;

  document.getElementById('detailContent').innerHTML = detailContent;
  document.getElementById('detailModal').classList.add('active');
}

/**
 * 상세 모달 닫기
 */
function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
}

// ==================== 유틸리티 함수 ====================

/**
 * 검색 처리
 */
function handleSearch() {
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(() => {
    currentPage = 1;
    filterAndDisplayPurchases();
  }, 300);
}

/**
 * 새로고침
 */
async function refreshPurchases() {
  const refreshBtn = document.querySelector('.btn-refresh');
  refreshBtn.style.transform = 'rotate(360deg)';

  await loadPurchases();

  setTimeout(() => {
    refreshBtn.style.transform = 'rotate(0deg)';
  }, 500);
}

/**
 * 로딩 표시
 */
function showLoading() {
  const container = document.getElementById('purchaseList');
  container.innerHTML = `
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <div class="loading-text">구매 내역을 불러오는 중...</div>
    </div>
  `;
}

/**
 * 에러 표시
 */
function showError(message) {
  const container = document.getElementById('purchaseList');
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <div class="error-title">오류가 발생했습니다</div>
      <div class="error-message">${message}</div>
      <button class="btn-retry" onclick="loadPurchases()">다시 시도</button>
    </div>
  `;
}

/**
 * 상품 이모지 가져오기
 */
function getProductEmoji(itemName) {
  const emojiMap = {
    츄파춥스: '🍭',
    초코파이: '🍫',
    아이스크림: '🍦',
    삼각김밥: '🍙',
    컵라면: '🍜',
    문상: '💳',
    에어팟: '🎧',
    연필: '✏️',
    공책: '📓',
    지우개: '🧽',
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (itemName.includes(key)) {
      return emoji;
    }
  }
  return '🎁'; // 기본 이모지
}

/**
 * 시간 관련 유틸리티
 */
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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
    return `${hours}시간 ${minutes}분 전`;
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

/**
 * 페이징 처리
 */
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

  // 페이지 번호
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="page-btn" onclick="changePage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span class="page-dots">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
             onclick="changePage(${i})">${i}</button>`;
  }

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

function changePage(page) {
  currentPage = page;
  displayPurchases();
  updatePagination();

  // 페이지 상단으로 스크롤
  document.querySelector('.purchase-list-container').scrollTop = 0;
}

// ==================== 이벤트 리스너 ====================

// 모달 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    if (e.target.id === 'deliveryModal') {
      closeDeliveryModal();
    } else if (e.target.id === 'detailModal') {
      closeDetailModal();
    }
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDeliveryModal();
    closeDetailModal();
  }
});

// 로그아웃 함수
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
  }
}
