// shop.js - 포인트샵 기능 (동적 로드 완전 구현)

// 전역 변수
let currentPoints = 0;
let selectedItem = null;
let allProducts = [];
let filteredProducts = [];
let currentCategory = 'all';

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  console.log('포인트샵 페이지 초기화');

  // 로그인 체크
  const studentId = localStorage.getItem('loginId');
  if (!studentId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 초기 로딩 표시
  showLoadingState();

  try {
    // 포인트 로드
    await loadMyPoints();

    // 상품 목록 로드
    await loadProducts();

    // 구매 내역 로드
    await loadPurchaseHistory();

    // 이벤트 리스너 설정
    setupEventListeners();
  } catch (error) {
    console.error('초기화 오류:', error);
    showErrorState();
  }
});

// 로딩 상태 표시
function showLoadingState() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
      <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
      <p style="color: #64748b;">상품을 불러오는 중...</p>
    </div>
  `;
}

// 에러 상태 표시
function showErrorState() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
      <div style="font-size: 48px; margin-bottom: 20px;">😢</div>
      <p style="color: #64748b; margin-bottom: 20px;">상품을 불러올 수 없습니다</p>
      <button class="btn btn-primary" onclick="location.reload()">새로고침</button>
    </div>
  `;
}

// 내 포인트 로드
async function loadMyPoints() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      currentPoints = result.data.currentPoints || 0;

      // 헤더 포인트 표시
      const myPointsEl = document.getElementById('myPoints');
      if (myPointsEl) {
        myPointsEl.textContent = currentPoints.toLocaleString() + 'P';
      }

      // 모달 포인트 표시
      const currentPointsEl = document.getElementById('currentPoints');
      if (currentPointsEl) {
        currentPointsEl.textContent = currentPoints.toLocaleString() + 'P';
      }

      console.log('포인트 로드 완료:', currentPoints);
    }
  } catch (error) {
    console.error('포인트 로드 오류:', error);
  }
}

// 상품 목록 로드
async function loadProducts() {
  try {
    const result = await api.getShopItems();

    if (result.success && result.data) {
      allProducts = result.data;
      console.log('상품 로드 완료:', allProducts.length + '개');

      // 상품이 없는 경우
      if (allProducts.length === 0) {
        showEmptyState();
        return;
      }

      // 초기 표시 (전체 상품)
      displayProducts(allProducts);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error('상품 로드 오류:', error);
    showErrorState();
  }
}

// 빈 상태 표시
function showEmptyState() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
      <div style="font-size: 48px; margin-bottom: 20px;">🛍️</div>
      <p style="color: #64748b;">현재 구매 가능한 상품이 없습니다</p>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 10px;">곧 새로운 상품이 추가될 예정입니다!</p>
    </div>
  `;
}

// 상품 표시 (핵심 함수)
function displayProducts(products) {
  const grid = document.getElementById('productsGrid');

  if (!products || products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
        <p style="color: #94a3b8;">해당 카테고리에 상품이 없습니다</p>
      </div>
    `;
    return;
  }

  // 상품 카드 생성
  grid.innerHTML = products
    .map((product) => {
      const isAffordable = currentPoints >= product.price;
      const isInStock = product.stock > 0;
      const canPurchase = isAffordable && isInStock;

      return `
      <div class="product-card" data-category="${product.category}" data-id="${
        product.item_id
      }">
        <div class="product-image">
          <span class="product-emoji">${getProductEmoji(
            product.category,
            product.name
          )}</span>
          ${
            product.stock <= 0
              ? '<span class="stock-badge" style="background: #ef4444;">품절</span>'
              : product.stock < 5
              ? `<span class="stock-badge stock-low">재고 ${product.stock}개</span>`
              : `<span class="stock-badge">재고 ${product.stock}개</span>`
          }
        </div>
        <div class="product-info">
          <h3 class="product-name">${product.name}</h3>
          <p class="product-desc">${
            product.description || getCategoryDescription(product.category)
          }</p>
          <div class="product-footer">
            <span class="product-price ${
              !isAffordable ? 'price-insufficient' : ''
            }">${product.price.toLocaleString()}P</span>
            <button 
              class="buy-btn ${!canPurchase ? 'btn-disabled' : ''}" 
              onclick="purchaseItem('${product.item_id}', '${product.name}', ${
        product.price
      }, ${product.stock})"
              ${!canPurchase ? 'disabled' : ''}
            >
              ${!isInStock ? '품절' : !isAffordable ? '포인트 부족' : '구매'}
            </button>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  // 스타일 추가 (포인트 부족 시 색상 변경)
  addCustomStyles();
}

// 커스텀 스타일 추가
function addCustomStyles() {
  if (!document.getElementById('shopCustomStyles')) {
    const style = document.createElement('style');
    style.id = 'shopCustomStyles';
    style.textContent = `
      .price-insufficient {
        color: #ef4444 !important;
      }
      .btn-disabled {
        background: #e5e7eb !important;
        color: #9ca3af !important;
        cursor: not-allowed !important;
      }
      .btn-disabled:hover {
        background: #e5e7eb !important;
        transform: none !important;
      }
      .product-card {
        transition: all 0.3s ease;
      }
      .product-card.hide {
        display: none;
      }
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .product-card {
        animation: slideIn 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }
}

// 상품 이모지 가져오기 (카테고리별)
function getProductEmoji(category, name) {
  // 특정 상품명에 따른 이모지
  const specificEmojis = {
    연필: '✏️',
    펜: '🖊️',
    노트: '📒',
    공책: '📓',
    지우개: '🧽',
    자: '📏',
    가위: '✂️',
    풀: '🧴',
    과자: '🍪',
    사탕: '🍬',
    초콜릿: '🍫',
    음료: '🥤',
    음료수: '🧃',
    빵: '🍞',
    도넛: '🍩',
    피자: '🍕',
    햄버거: '🍔',
    치킨: '🍗',
    문화상품권: '🎁',
    상품권: '🎫',
    쿠폰: '🎟️',
    영화: '🎬',
    게임: '🎮',
  };

  // 상품명에서 키워드 찾기
  for (const [keyword, emoji] of Object.entries(specificEmojis)) {
    if (name.includes(keyword)) {
      return emoji;
    }
  }

  // 카테고리별 기본 이모지
  const categoryEmojis = {
    stationery: '✏️',
    snack: '🍪',
    food: '🍔',
    voucher: '🎁',
    special: '⭐',
    book: '📚',
    toy: '🎲',
  };

  return categoryEmojis[category] || '🎁';
}

// 카테고리 설명 가져오기
function getCategoryDescription(category) {
  const descriptions = {
    stationery: '학습에 필요한 문구류',
    snack: '맛있는 간식',
    food: '든든한 먹거리',
    voucher: '다양하게 사용 가능',
    special: '특별한 상품',
    book: '지식을 쌓는 도서',
    toy: '재미있는 장난감',
  };

  return descriptions[category] || '포인트로 구매 가능';
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 카테고리 필터
  document.querySelectorAll('.category-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // 활성 탭 변경
      document
        .querySelectorAll('.category-btn')
        .forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');

      // 카테고리 필터링
      currentCategory = e.target.dataset.category;
      filterProducts(currentCategory);
    });
  });

  // 모달 외부 클릭 시 닫기
  document.getElementById('purchaseModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'purchaseModal') {
      closePurchaseModal();
    }
  });

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePurchaseModal();
    }
  });
}

// 상품 필터링
function filterProducts(category) {
  console.log('필터링:', category);

  if (category === 'all') {
    filteredProducts = allProducts;
  } else {
    filteredProducts = allProducts.filter(
      (product) => product.category === category
    );
  }

  displayProducts(filteredProducts);
}

// 상품 구매
function purchaseItem(itemId, itemName, price, stock) {
  console.log('구매 시도:', { itemId, itemName, price, stock });

  // 재고 확인
  if (stock <= 0) {
    alert('죄송합니다. 해당 상품은 품절되었습니다.');
    return;
  }

  // 포인트 확인
  if (currentPoints < price) {
    alert(
      `포인트가 부족합니다!\n필요 포인트: ${price}P\n보유 포인트: ${currentPoints}P\n부족한 포인트: ${
        price - currentPoints
      }P`
    );
    return;
  }

  // 선택 상품 정보 저장
  selectedItem = {
    id: itemId,
    name: itemName,
    price: price,
    stock: stock,
  };

  // 모달에 정보 표시
  const emoji = getProductEmoji('', itemName);
  document.getElementById('purchaseEmoji').textContent = emoji;
  document.getElementById('purchaseName').textContent = itemName;
  document.getElementById('purchasePrice').textContent =
    price.toLocaleString() + 'P';
  document.getElementById('currentPoints').textContent =
    currentPoints.toLocaleString() + 'P';
  document.getElementById('afterPoints').textContent =
    (currentPoints - price).toLocaleString() + 'P';

  // 구매 후 잔액이 음수인지 체크
  const afterPointsEl = document.getElementById('afterPoints');
  if (currentPoints - price < 0) {
    afterPointsEl.style.color = '#ef4444';
  } else {
    afterPointsEl.style.color = '#333';
  }

  // 모달 열기
  document.getElementById('purchaseModal').classList.add('active');

  // 구매 확인 버튼 이벤트
  document.getElementById('confirmPurchase').onclick = confirmPurchase;
}

// 구매 확인
async function confirmPurchase() {
  if (!selectedItem) return;

  const confirmBtn = document.getElementById('confirmPurchase');
  const originalText = confirmBtn.textContent;

  try {
    // 버튼 로딩 상태
    confirmBtn.disabled = true;
    confirmBtn.textContent = '구매 중...';

    const studentId = localStorage.getItem('loginId');
    const result = await api.purchaseItem(studentId, selectedItem.id);

    if (result.success) {
      // 성공 메시지
      alert(
        `🎉 구매가 완료되었습니다!\n\n상품명: ${selectedItem.name}\n결제 금액: ${selectedItem.price}P\n\n📍 데스크에서 상품을 수령해주세요.`
      );

      // 포인트 업데이트
      currentPoints -= selectedItem.price;
      document.getElementById('myPoints').textContent =
        currentPoints.toLocaleString() + 'P';

      // 구매 내역 추가
      addPurchaseHistory(selectedItem);

      // 상품 목록 새로고침 (재고 업데이트)
      await loadProducts();

      // 모달 닫기
      closePurchaseModal();
    } else {
      alert(result.error || '구매에 실패했습니다. 다시 시도해주세요.');
    }
  } catch (error) {
    console.error('구매 오류:', error);
    alert('구매 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    // 버튼 복구
    confirmBtn.disabled = false;
    confirmBtn.textContent = originalText;
  }
}

// 구매 내역 추가
function addPurchaseHistory(item) {
  const historyList = document.getElementById('historyList');
  if (!historyList) return;

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });

  const newHistory = document.createElement('div');
  newHistory.className = 'history-item';
  newHistory.style.animation = 'slideIn 0.3s ease';
  newHistory.innerHTML = `
    <div class="history-info">
      <span class="history-icon">${getProductEmoji('', item.name)}</span>
      <div>
        <div class="history-name">${item.name}</div>
        <div class="history-date">${today}</div>
      </div>
    </div>
    <span class="history-price">-${item.price.toLocaleString()}P</span>
  `;

  // 최상단에 추가
  historyList.insertBefore(newHistory, historyList.firstChild);

  // 5개 초과 시 마지막 항목 제거
  const items = historyList.querySelectorAll('.history-item');
  if (items.length > 5) {
    items[items.length - 1].remove();
  }
}

// 구매 내역 로드
async function loadPurchaseHistory() {
  try {
    const studentId = localStorage.getItem('loginId');
    const result = await api.getTransactionHistory(studentId);

    if (result.success && result.data) {
      // purchase 타입만 필터링
      const purchases = result.data
        .filter((item) => item.type === 'purchase')
        .slice(0, 5); // 최근 5개만

      const historyList = document.getElementById('historyList');
      if (!historyList) return;

      if (purchases.length === 0) {
        historyList.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #94a3b8;">
            아직 구매 내역이 없습니다
          </div>
        `;
        return;
      }

      historyList.innerHTML = purchases
        .map((item) => {
          const date = new Date(item.createdAt).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
          });

          return `
          <div class="history-item">
            <div class="history-info">
              <span class="history-icon">${getProductEmoji(
                '',
                item.itemName
              )}</span>
              <div>
                <div class="history-name">${item.itemName}</div>
                <div class="history-date">${date}</div>
              </div>
            </div>
            <span class="history-price">${item.amount.toLocaleString()}P</span>
          </div>
        `;
        })
        .join('');
    }
  } catch (error) {
    console.error('구매 내역 로드 오류:', error);
  }
}

// 모달 닫기
function closePurchaseModal() {
  document.getElementById('purchaseModal').classList.remove('active');
  selectedItem = null;
}

// 전역 함수로 내보내기 (HTML onclick에서 호출)
window.purchaseItem = purchaseItem;
window.closePurchaseModal = closePurchaseModal;

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

console.log('shop.js 로드 완료');
