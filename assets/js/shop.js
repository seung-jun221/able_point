// shop.js - 포인트샵 기능 (구매 제한 시스템 포함) - 완전 개선 버전

// 전역 변수
let shopItems = [];
let currentPoints = 0;
let selectedItem = null;
let currentCategory = 'all';

// 구매 제한 설정
const PURCHASE_LIMIT = {
  maxPurchasesPerWeek: 1,
  resetDay: 1, // 월요일 (0=일요일, 1=월요일)
  resetHour: 9, // 오전 9시
};

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('상점 페이지 초기화');

  // 로그인 체크
  const loginId = localStorage.getItem('loginId');
  const userName = localStorage.getItem('userName');

  if (!loginId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 사용자 정보 표시
  if (userName) {
    document.getElementById('userName').textContent = userName;
  }

  // 포인트 정보 로드
  await loadUserPoints();

  // 상품 목록 로드
  await loadProducts();

  // 구매 제한 배너 업데이트
  await updatePurchaseLimitBanner(); // await 추가

  // 최근 구매 내역 로드
  await loadRecentPurchases();

  console.log('상점 페이지 초기화 완료');
});

// ==================== 구매 제한 시스템 ====================

/**
 * 현재 주차 계산 (월요일 오전 9시 기준)
 */
function getCurrentWeekKey() {
  const now = new Date();

  // 월요일 오전 9시를 기준으로 주차 계산
  const currentDay = now.getDay(); // 0=일요일, 1=월요일
  const currentHour = now.getHours();

  // 현재 날짜에서 월요일 오전 9시까지의 일수 계산
  let daysToMonday = currentDay === 0 ? 1 : 8 - currentDay; // 다음 주 월요일까지

  // 월요일인데 아직 9시 전이면 이전 주로 계산
  if (currentDay === 1 && currentHour < PURCHASE_LIMIT.resetHour) {
    daysToMonday = 7;
  }

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
  weekStart.setHours(PURCHASE_LIMIT.resetHour, 0, 0, 0);

  // 현재 시간이 이번 주 월요일 9시 이전이면 이전 주로 설정
  if (now < weekStart) {
    weekStart.setDate(weekStart.getDate() - 7);
  }

  return `${weekStart.getFullYear()}-W${Math.ceil(
    weekStart.getDate() / 7
  )}-${weekStart.getMonth()}`;
}

/**
 * 구매 제한 체크 (DB 기반으로 수정)
/**
 * 구매 제한 체크 (shop.js)
 */
async function checkPurchaseLimit() {
  try {
    const loginId = localStorage.getItem('loginId');
    console.log('[Shop] 구매 제한 체크 시작:', loginId);

    // DB에서 실제 구매 내역 확인
    const studentResult = await api.getStudentPoints(loginId);
    if (!studentResult.success) {
      console.error('[Shop] 학생 정보 조회 실패');
      return { canPurchase: false, remainingPurchases: 0 };
    }

    const studentId = studentResult.data.studentId;
    console.log('[Shop] 학생 ID:', studentId);

    // API의 checkWeeklyPurchaseLimit 호출
    const limitResult = await api.checkWeeklyPurchaseLimit(studentId);

    console.log('[Shop] 구매 제한 체크 결과:', limitResult);

    return {
      canPurchase: limitResult.canPurchase,
      purchaseCount: limitResult.purchaseCount,
      remainingPurchases: limitResult.remainingPurchases,
      currentWeek: getCurrentWeekKey(),
    };
  } catch (error) {
    console.error('[Shop] 구매 제한 체크 실패:', error);
    // 에러 시 구매 차단 (안전장치)
    return { canPurchase: false, remainingPurchases: 0 };
  }
}

/**
 * 구매 제한 배너 업데이트 (비동기로 수정)
 */
async function updatePurchaseLimitBanner() {
  const banner = document.getElementById('purchaseLimitBanner');
  const remainingSpan = document.getElementById('remainingPurchases');
  const statusIcon = document.querySelector('.banner-status .status-icon');
  const bannerMessage = document.getElementById('bannerMessage');
  const resetInfo = document.getElementById('bannerResetInfo');

  // 로딩 표시
  bannerMessage.innerHTML = '구매 제한 확인 중...';

  const limitStatus = await checkPurchaseLimit(); // await 추가

  // 남은 구매 횟수 표시
  remainingSpan.textContent = limitStatus.remainingPurchases;

  // 다음 리셋 시간 계산
  const nextReset = getNextResetTime();
  resetInfo.textContent = `다음 리셋: ${nextReset}`;

  if (limitStatus.canPurchase) {
    banner.classList.remove('exhausted');
    statusIcon.textContent = '✅';
    bannerMessage.innerHTML = `이번 주 구매 가능 횟수: <span id="remainingPurchases">${limitStatus.remainingPurchases}</span>/1회`;
  } else {
    banner.classList.add('exhausted');
    statusIcon.textContent = '🚫';
    bannerMessage.innerHTML = `이번 주 구매 횟수를 모두 사용했습니다`;
  }
}

/**
 * 구매 버튼 클릭 - async 추가 필수!
 */
async function purchaseItem(itemId, itemName, price, stock, imageUrl, emoji) {
  console.log('구매 시도:', { itemId, itemName, price, stock });

  // 구매 제한 체크 - await 추가!
  const limitStatus = await checkPurchaseLimit(); // ⭐ await 추가

  console.log('구매 제한 상태:', limitStatus); // 디버깅용

  if (!limitStatus.canPurchase) {
    showPurchaseLimitModal();
    return;
  }

  // 재고 확인
  if (stock <= 0) {
    alert('해당 상품은 품절되었습니다.');
    return;
  }

  // 포인트 확인
  if (currentPoints < price) {
    alert(
      `포인트가 부족합니다!\n필요 포인트: ${price.toLocaleString()}P\n보유 포인트: ${currentPoints.toLocaleString()}P\n부족한 포인트: ${(
        price - currentPoints
      ).toLocaleString()}P`
    );
    return;
  }

  // 선택 상품 정보 저장
  selectedItem = {
    id: itemId,
    name: itemName,
    price: price,
    stock: stock,
    imageUrl: imageUrl,
    emoji: emoji,
  };

  showPurchaseModal();
}

/**
/**
 * 구매 확인
 */
async function confirmPurchase() {
  if (!selectedItem) return;

  const confirmBtn = document.getElementById('confirmPurchase');
  const originalText = confirmBtn.textContent;

  try {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="loading-spinner"></span> 구매 중...';

    const loginId = localStorage.getItem('loginId');
    const result = await api.purchaseItem(loginId, selectedItem.id);

    if (result.success) {
      // 🆕 수령 일정 정보 포함한 알림
      alert(
        `✅ 구매가 완료되었습니다!\n\n` +
          `📦 상품명: ${selectedItem.name}\n` +
          `💰 결제 금액: ${selectedItem.price.toLocaleString()}P\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `📍 선물 수령 안내\n` +
          `• 수령 가능일: 매주 수요일, 목요일\n` +
          `• 수령 장소: 데스크\n` +
          `• 수령 불가 시간:\n` +
          `  - 5:20~5:30 (하원 시간)\n` +
          `  - 6:55~7:05 (하원 시간)\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `위 시간을 피해서 데스크를 방문해주세요! 😊`
      );

      // 1초 후 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 1000);

      // 포인트 업데이트
      currentPoints -= selectedItem.price;
      localStorage.setItem('currentPoints', currentPoints.toString());

      // UI 업데이트
      const headerPoints = document.getElementById('headerTotalPoints');
      if (headerPoints) {
        headerPoints.textContent = currentPoints.toLocaleString() + 'P';
      }

      // 구매 제한 배너 업데이트
      await updatePurchaseLimitBanner();

      // 상품 목록 새로고침
      await loadProducts();

      // 최근 구매 내역 새로고침
      await loadRecentPurchases();

      // 모달 닫기
      closePurchaseModal();
    } else {
      alert(result.error || '구매에 실패했습니다. 다시 시도해주세요.');
    }
  } catch (error) {
    console.error('구매 오류:', error);
    alert('구매 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;
  }
}

/**
 * 다음 리셋 시간 계산
 */
function getNextResetTime() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHour = now.getHours();

  let daysUntilReset;

  if (currentDay === 1 && currentHour < PURCHASE_LIMIT.resetHour) {
    // 월요일이지만 아직 9시 전
    return `오늘 오전 ${PURCHASE_LIMIT.resetHour}시`;
  } else if (currentDay === 1) {
    // 월요일 9시 이후
    daysUntilReset = 7;
  } else if (currentDay === 0) {
    // 일요일
    daysUntilReset = 1;
  } else {
    // 화~토요일
    daysUntilReset = 8 - currentDay;
  }

  const resetDate = new Date(now);
  resetDate.setDate(now.getDate() + daysUntilReset);

  const options = { month: 'long', day: 'numeric' };
  return `${resetDate.toLocaleDateString('ko-KR', options)} (월) 오전 9시`;
}

/**
 * 구매 기록 저장
 */
function recordPurchase() {
  const loginId = localStorage.getItem('loginId');
  const currentWeek = getCurrentWeekKey();
  const purchaseKey = `purchase_limit_${loginId}_${currentWeek}`;

  const currentCount = parseInt(localStorage.getItem(purchaseKey) || '0');
  localStorage.setItem(purchaseKey, (currentCount + 1).toString());
}

// ==================== 데이터 로드 ====================

/**
 * 사용자 포인트 정보 로드
 */
async function loadUserPoints() {
  try {
    const loginId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(loginId);

    if (result.success && result.data) {
      currentPoints = result.data.currentPoints || 0;

      // 헤더 포인트 업데이트
      const headerPoints = document.getElementById('headerTotalPoints');
      if (headerPoints) {
        headerPoints.textContent = currentPoints.toLocaleString() + 'P';
      }
    }
  } catch (error) {
    console.error('포인트 정보 로드 실패:', error);

    // localStorage 백업 사용
    currentPoints = parseInt(localStorage.getItem('currentPoints') || '0');
    const headerPoints = document.getElementById('headerTotalPoints');
    if (headerPoints) {
      headerPoints.textContent = currentPoints.toLocaleString() + 'P';
    }
  }
}

/**
 * 상품 목록 로드
 */
async function loadProducts() {
  try {
    const result = await api.getShopItems();

    if (result.success && result.data) {
      shopItems = result.data;
      displayProducts();
    } else {
      console.error('상품 로드 실패:', result.error);
      showError('상품 목록을 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('상품 로드 에러:', error);
    showError('상품 목록을 불러오는 중 오류가 발생했습니다.');
  }
}

/**
 * 상품 목록 표시
 */
function displayProducts() {
  const grid = document.getElementById('productsGrid');

  if (!shopItems || shopItems.length === 0) {
    grid.innerHTML = `
      <div class="no-products">
        <div class="empty-icon">📦</div>
        <div class="empty-message">등록된 상품이 없습니다</div>
        <div class="empty-submessage">잠시 후 다시 확인해주세요</div>
      </div>
    `;
    return;
  }

  // 카테고리 필터링
  const filteredItems =
    currentCategory === 'all'
      ? shopItems
      : shopItems.filter((item) => item.category === currentCategory);

  grid.innerHTML = filteredItems
    .map((item) => createProductCard(item))
    .join('');
}

/**
 * 상품 카드 생성
 */
function createProductCard(item) {
  const isOutOfStock = item.stock <= 0;
  const isLowStock = item.stock <= 10 && item.stock > 0;

  // 이미지 처리 (실물 이미지 우선, 없으면 이모지)
  const imageHtml = item.image
    ? `<img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
    : '';

  // 이모지 fallback
  const emoji = getProductEmoji(item.category, item.name);
  const emojiHtml = `<span class="product-emoji" ${
    item.image ? 'style="display:none;"' : ''
  }>${emoji}</span>`;

  const stockBadgeClass = isOutOfStock
    ? 'stock-out'
    : isLowStock
    ? 'stock-low'
    : '';
  const stockText = isOutOfStock ? '품절' : `재고 ${item.stock}개`;

  return `
  <div class="product-card ${
    isOutOfStock ? 'out-of-stock' : ''
  }" data-category="${item.category}">
      <div class="product-image">
        ${imageHtml}
        ${emojiHtml}
        <span class="stock-badge ${stockBadgeClass}">${stockText}</span>
      </div>
      <div class="product-info">
        <h3 class="product-name">${item.name}</h3>
        <p class="product-desc">${item.description || '포인트샵 인기 상품'}</p>
        <div class="product-footer">
          <span class="product-price">${item.price.toLocaleString()}P</span>
          <button 
      class="buy-btn" 
      ${isOutOfStock ? 'disabled' : ''}
      onclick="purchaseItem('${item.item_id}', '${item.name}', ${item.price}, ${
    item.stock
  }, '${item.image || ''}', '${emoji}')"
    >
      ${isOutOfStock ? '품절' : '구매'}
    </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 상품별 이모지 반환
 */
function getProductEmoji(category, name) {
  const categoryEmojis = {
    학용품: ['📚', '✏️', '📝', '📏', '✂️'],
    간식: ['🍭', '🍬', '🍫', '🍩', '🍪'],
    장난감: ['🎮', '🎯', '🎲', '🧸', '🎨'],
    쿠폰: ['🎫', '🎁', '🏆'],
    기타: ['⭐', '✨', '🎪'],
  };

  const emojis = categoryEmojis[category] || categoryEmojis['기타'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

/**
 * 최근 구매 내역 로드 (다른 학생 페이지와 동일한 방식)
 */
async function loadRecentPurchases() {
  const container = document.getElementById('recentPurchasesList');
  if (!container) return;

  try {
    const loginId = localStorage.getItem('loginId');
    console.log('구매 내역 로드 시작:', loginId);

    // ✅ 다른 학생 페이지와 동일: 병렬로 두 API 호출
    const [pointsResult, transResult] = await Promise.all([
      api.getPointHistory(loginId),
      api.getTransactionHistory(loginId),
    ]);

    console.log('Points API 결과:', pointsResult);
    console.log('Transaction API 결과:', transResult);

    // 모든 구매 관련 활동 수집
    const allPurchaseActivities = [];

    // Points 데이터에서 구매 관련 항목 추가
    if (pointsResult.success && pointsResult.data) {
      pointsResult.data.forEach((item) => {
        // 구매, 상점 관련 타입만 필터링
        if (
          ['purchase', 'shop', 'buy'].includes(item.type) ||
          (item.reason && item.reason.includes('구매'))
        ) {
          allPurchaseActivities.push({
            date: item.date,
            type: item.type,
            name: item.reason || getDefaultPurchaseTitle(item.type),
            amount: Math.abs(item.amount || 0),
            source: 'points',
            imageUrl: null,
          });
        }
      });
    }

    // Transaction 데이터에서 구매 관련 항목 추가
    if (transResult.success && transResult.data) {
      transResult.data.forEach((item) => {
        // purchase 타입만 필터링
        if (item.type === 'purchase') {
          allPurchaseActivities.push({
            date: item.createdAt || item.created_at || item.date,
            type: item.type,
            name:
              item.itemName ||
              item.item_name ||
              item.shop_item_name ||
              '상품 구매',
            amount: Math.abs(item.amount || item.price || 0),
            source: 'transactions',
            imageUrl: item.image_url || item.image,
          });
        }
      });
    }

    console.log('통합된 구매 활동:', allPurchaseActivities);

    // ✅ 다른 학생 페이지와 동일: 날짜순 정렬 후 최근 3개만
    allPurchaseActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentPurchases = allPurchaseActivities.slice(0, 3);

    if (recentPurchases.length > 0) {
      console.log('구매 내역 표시:', recentPurchases.length, '개');
      container.innerHTML = recentPurchases
        .map((purchase) => {
          console.log('구매 항목 처리:', purchase);

          return `
          <div class="recent-item">
            <div class="recent-info">
              <div class="recent-image">
                ${
                  purchase.imageUrl
                    ? `<img src="${purchase.imageUrl}" alt="${
                        purchase.name
                      }" onerror="this.parentNode.innerHTML='<span>${getProductEmoji(
                        '',
                        purchase.name
                      )}</span>'">`
                    : `<span>${getProductEmoji('', purchase.name)}</span>`
                }
              </div>
              <div class="recent-details">
                <div class="recent-name">${purchase.name}</div>
                <div class="recent-date">${formatTimeAgo(purchase.date)}</div>
              </div>
            </div>
            <span class="recent-price">-${purchase.amount.toLocaleString()}P</span>
          </div>
        `;
        })
        .join('');
    } else {
      console.log('구매 내역이 없음');
      container.innerHTML = `
        <div class="no-recent-purchases">
          <div class="empty-icon">🛒</div>
          <div class="empty-message">최근 구매 내역이 없습니다</div>
          <div class="empty-submessage">포인트로 다양한 상품을 구매해보세요!</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('구매 내역 로드 실패:', error);

    // 에러 시에도 기본 메시지 표시
    container.innerHTML = `
      <div class="no-recent-purchases">
        <div class="empty-icon">⚠️</div>
        <div class="empty-message">구매 내역을 불러올 수 없습니다</div>
        <div class="empty-submessage">잠시 후 다시 시도해주세요</div>
      </div>
    `;
  }
}

// ==================== 헬퍼 함수들 ====================

/**
 * 구매 관련 기본 제목 생성
 */
function getDefaultPurchaseTitle(type) {
  const titles = {
    purchase: '상품 구매',
    shop: '포인트샵 구매',
    buy: '아이템 구매',
  };
  return titles[type] || '상품 구매';
}

/**
 * 시간 경과 표시 (다른 학생 페이지와 동일)
 */
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

/**
 * 구매 확인 모달 표시
 */
function showPurchaseModal() {
  if (!selectedItem) return;

  // 모달에 정보 표시
  const purchaseImage = document.getElementById('purchaseImage');

  if (selectedItem.imageUrl) {
    purchaseImage.innerHTML = `<img src="${selectedItem.imageUrl}" alt="${selectedItem.name}" onerror="showEmojiInModal()">`;
  } else {
    purchaseImage.innerHTML = `<span class="purchase-emoji">${selectedItem.emoji}</span>`;
  }

  document.getElementById('purchaseName').textContent = selectedItem.name;
  document.getElementById('purchasePrice').textContent =
    selectedItem.price.toLocaleString() + 'P';
  document.getElementById('currentPoints').textContent =
    currentPoints.toLocaleString() + 'P';
  document.getElementById('afterPoints').textContent =
    (currentPoints - selectedItem.price).toLocaleString() + 'P';

  // 구매 후 잔액 색상
  const afterPointsEl = document.getElementById('afterPoints');
  if (currentPoints - selectedItem.price < 0) {
    afterPointsEl.style.color = '#ef4444';
  } else {
    afterPointsEl.style.color = '#059669';
  }

  // 모달 열기
  document.getElementById('purchaseModal').classList.add('active');

  // 구매 확인 버튼 이벤트
  document.getElementById('confirmPurchase').onclick = confirmPurchase;
}

/**
 * 이미지 로드 실패 시 이모지 표시
 */
function showEmojiInModal() {
  if (selectedItem) {
    const purchaseImage = document.getElementById('purchaseImage');
    purchaseImage.innerHTML = `<span class="purchase-emoji">${selectedItem.emoji}</span>`;
  }
}

/**
 * 구매 제한 모달 표시
 */
function showPurchaseLimitModal() {
  const nextResetTime = getNextResetTime();
  document.getElementById('nextPurchaseDate').textContent = nextResetTime;
  document.getElementById('purchaseLimitModal').classList.add('active');
}

// ==================== UI 제어 ====================

/**
 * 카테고리 필터링
 */
function filterProducts(category) {
  currentCategory = category;

  // 탭 활성화 상태 변경
  document.querySelectorAll('.category-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  // 상품 표시 업데이트
  displayProducts();
}

/**
 * 구매 확인 모달 닫기
 */
function closePurchaseModal() {
  document.getElementById('purchaseModal').classList.remove('active');
  selectedItem = null;
}

/**
 * 구매 제한 모달 닫기
 */
function closePurchaseLimitModal() {
  document.getElementById('purchaseLimitModal').classList.remove('active');
}

/**
 * 에러 메시지 표시
 */
function showError(message) {
  alert(message);
}

// ==================== 네비게이션 연동 ====================

/**
 * 알림 클릭 처리
 */
function handleNotificationClick() {
  // 알림 기능은 향후 구현
  console.log('알림 클릭');
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    if (e.target.id === 'purchaseModal') {
      closePurchaseModal();
    } else if (e.target.id === 'purchaseLimitModal') {
      closePurchaseLimitModal();
    }
  }
});

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePurchaseModal();
    closePurchaseLimitModal();
  }
});
