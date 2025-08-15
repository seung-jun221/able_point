// shop.js - 포인트샵 기능

let currentPoints = 0;
let selectedItem = null;
const studentId = localStorage.getItem('loginId');

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', async () => {
  // 로그인 체크
  if (!studentId) {
    alert('로그인이 필요합니다.');
    window.location.href = '../login.html';
    return;
  }

  // 포인트 로드
  await loadMyPoints();

  // 상품 목록 로드
  await loadProducts();

  // 이벤트 리스너 설정
  setupEventListeners();
});

// 내 포인트 로드
async function loadMyPoints() {
  try {
    const result = await api.getStudentPoints(studentId);

    if (result.success) {
      currentPoints = result.data.currentPoints;
      document.getElementById('myPoints').textContent = currentPoints + 'P';
      document.getElementById('currentPoints').textContent =
        currentPoints + 'P';
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
      displayProducts(result.data);
    }
  } catch (error) {
    console.error('상품 로드 오류:', error);
  }
}

// 상품 표시
function displayProducts(products) {
  // 실제로는 API에서 받은 데이터로 상품 카드를 동적으로 생성
  console.log('상품 목록:', products);
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
      const category = e.target.dataset.category;
      filterProducts(category);
    });
  });
}

// 상품 필터링
function filterProducts(category) {
  const products = document.querySelectorAll('.product-card');

  products.forEach((product) => {
    if (category === 'all') {
      product.classList.remove('hidden');
    } else {
      if (product.dataset.category === category) {
        product.classList.remove('hidden');
      } else {
        product.classList.add('hidden');
      }
    }
  });
}

// 상품 구매
function purchaseItem(itemId, itemName, price) {
  // 포인트 확인
  if (currentPoints < price) {
    alert('포인트가 부족합니다!');
    return;
  }

  // 선택 상품 정보 저장
  selectedItem = {
    id: itemId,
    name: itemName,
    price: price,
  };

  // 모달에 정보 표시
  const emoji = getItemEmoji(itemName);
  document.getElementById('purchaseEmoji').textContent = emoji;
  document.getElementById('purchaseName').textContent = itemName;
  document.getElementById('purchasePrice').textContent = price + 'P';
  document.getElementById('currentPoints').textContent = currentPoints + 'P';
  document.getElementById('afterPoints').textContent =
    currentPoints - price + 'P';

  // 모달 열기
  document.getElementById('purchaseModal').classList.add('active');

  // 구매 확인 버튼 이벤트
  document.getElementById('confirmPurchase').onclick = confirmPurchase;
}

// 구매 확인
async function confirmPurchase() {
  if (!selectedItem) return;

  try {
    const result = await api.purchaseItem(studentId, selectedItem.id);

    if (result.success) {
      alert('구매가 완료되었습니다!\n데스크에서 상품을 수령해주세요.');

      // 포인트 새로고침
      currentPoints -= selectedItem.price;
      document.getElementById('myPoints').textContent = currentPoints + 'P';

      // 구매 내역 추가
      addPurchaseHistory(selectedItem);

      // 모달 닫기
      closePurchaseModal();
    } else {
      alert(result.error || '구매에 실패했습니다.');
    }
  } catch (error) {
    console.error('구매 오류:', error);
    alert('구매 중 오류가 발생했습니다.');
  }
}

// 구매 내역 추가
function addPurchaseHistory(item) {
  const historyList = document.getElementById('historyList');
  const today = new Date()
    .toLocaleDateString('ko-KR')
    .replace(/\. /g, '.')
    .replace('.', '');

  const newHistory = document.createElement('div');
  newHistory.className = 'history-item';
  newHistory.innerHTML = `
        <div class="history-info">
            <span class="history-icon">${getItemEmoji(item.name)}</span>
            <div>
                <div class="history-name">${item.name}</div>
                <div class="history-date">${today}</div>
            </div>
        </div>
        <span class="history-price">-${item.price}P</span>
    `;

  historyList.insertBefore(newHistory, historyList.firstChild);
}

// 아이템 이모지 가져오기
function getItemEmoji(itemName) {
  const emojiMap = {
    연필: '✏️',
    과자: '🍪',
    노트: '📒',
    문화상품권: '🎁',
    피자: '🍕',
    문구: '✂️',
    음료: '🥤',
    게임: '🎮',
  };

  for (let key in emojiMap) {
    if (itemName.includes(key)) {
      return emojiMap[key];
    }
  }
  return '🎁';
}

// 모달 닫기
function closePurchaseModal() {
  document.getElementById('purchaseModal').classList.remove('active');
  selectedItem = null;
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePurchaseModal();
  }
});

// 모달 외부 클릭 시 닫기
document.getElementById('purchaseModal')?.addEventListener('click', (e) => {
  if (e.target.id === 'purchaseModal') {
    closePurchaseModal();
  }
});
