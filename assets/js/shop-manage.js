// shop-manage.js - 상점 관리 기능

// 전역 변수
let shopItems = [];
let filteredItems = [];
let currentEditId = null;
let currentImageUrl = null; // 현재 업로드된 이미지 URL

// 이모지 목록
const EMOJI_LIST = [
  // 학용품
  '📚',
  '📖',
  '✏️',
  '📝',
  '📏',
  '📐',
  '✂️',
  '🖍️',
  '🖊️',
  '🖌️',
  // 간식
  '🍭',
  '🍬',
  '🍫',
  '🍩',
  '🍪',
  '🍰',
  '🧁',
  '🍿',
  '🥤',
  '🧃',
  // 장난감
  '🎮',
  '🎯',
  '🎲',
  '🧸',
  '🎨',
  '🏀',
  '⚽',
  '🎾',
  '🏐',
  '🎱',
  // 쿠폰/특별
  '🎫',
  '🎟️',
  '🎁',
  '🏆',
  '🥇',
  '🥈',
  '🥉',
  '⭐',
  '🌟',
  '✨',
  // 기타
  '📱',
  '🎧',
  '⌚',
  '💼',
  '🎒',
  '👕',
  '🧢',
  '🕶️',
  '🔑',
  '🛍️',
];

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('상점 관리 페이지 초기화');

  // 로그인 체크
  const loginId = localStorage.getItem('loginId');
  const userRole = localStorage.getItem('userRole');

  // 원장 권한 체크
  if (loginId !== 'ablemaster') {
    alert('원장 권한이 필요합니다.');
    window.location.href = 'index.html';
    return;
  }

  // Supabase Storage 버킷 생성 확인
  await ensureStorageBucket();

  // 데이터 로드
  await loadShopItems();

  // 이모지 그리드 초기화
  initializeEmojiGrid();

  // 이미지 업로드 이벤트 설정
  setupImageUpload();

  // Enter 키 검색 이벤트
  document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') filterItems();
  });
});

// ==================== 이미지 업로드 기능 ====================
function setupImageUpload() {
  const uploadArea = document.getElementById('uploadArea');

  // 클릭해서 파일 선택
  uploadArea?.addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  // 드래그 앤 드롭
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea?.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea?.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      await uploadImage(files[0]);
    }
  });

  // 붙여넣기 (Ctrl+V)
  document.addEventListener('paste', async (e) => {
    // 모달이 열려있을 때만 작동
    if (!document.getElementById('itemModal').classList.contains('active'))
      return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        await uploadImage(file);
        break;
      }
    }
  });
}

// 파일 선택 핸들러
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    await uploadImage(file);
  }
}

// 이미지 업로드 함수
async function uploadImage(file) {
  // 파일 크기 체크 (2MB)
  if (file.size > 2 * 1024 * 1024) {
    toastr.warning('이미지 크기는 2MB 이하여야 합니다.', '알림');
    return;
  }

  const uploadStatus = document.getElementById('uploadStatus');
  uploadStatus.style.display = 'block';
  uploadStatus.innerHTML = '⏳ 이미지 업로드 중...';

  try {
    const fileName = `products/${Date.now()}_${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      '_'
    )}`;

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('shop-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // 공개 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(fileName);

    currentImageUrl = urlData.publicUrl;

    // 미리보기 표시
    showImagePreview(currentImageUrl);

    // URL 입력란에도 표시
    document.getElementById('itemImage').value = currentImageUrl;

    uploadStatus.innerHTML = '✅ 업로드 완료!';
    setTimeout(() => {
      uploadStatus.style.display = 'none';
    }, 2000);
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    uploadStatus.innerHTML = '❌ 업로드 실패';
    toastr.error('이미지 업로드에 실패했습니다.', '오류');
  }
}

// 이미지 미리보기 표시
function showImagePreview(url) {
  const previewContent = document.getElementById('previewContent');
  const removeBtn = document.querySelector('.btn-remove-image');

  if (url.startsWith('http')) {
    // URL 이미지
    previewContent.innerHTML = `<img src="${url}" alt="상품 이미지" onerror="this.src=''; this.onerror=null; this.parentElement.innerHTML='❌';">`;
  } else {
    // 이모지
    previewContent.innerHTML = `<span class="preview-emoji">${url}</span>`;
  }

  removeBtn.style.display = 'block';
}

// 이미지 제거
function removeImage() {
  document.getElementById('previewContent').innerHTML =
    '<span class="preview-placeholder">📦</span>';
  document.getElementById('itemImage').value = '';
  document.querySelector('.btn-remove-image').style.display = 'none';
  currentImageUrl = null;
}

// Storage 버킷 생성 확인
async function ensureStorageBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();

    if (!buckets.find((b) => b.name === 'shop-images')) {
      // 버킷이 없으면 생성
      await supabase.storage.createBucket('shop-images', {
        public: true,
        allowedMimeTypes: ['image/*'],
        fileSizeLimit: 2097152, // 2MB
      });
      console.log('shop-images 버킷 생성 완료');
    }
  } catch (error) {
    console.error('Storage 버킷 확인 오류:', error);
  }
}

// ==================== 데이터 로드 ====================
async function loadShopItems() {
  try {
    const { data, error } = await supabase
      .from('shop_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    shopItems = data || [];
    console.log('상품 로드 완료:', shopItems.length);

    displayItems(shopItems);
  } catch (error) {
    console.error('상품 로드 오류:', error);
    toastr.error('상품을 불러오는데 실패했습니다.', '오류');
  }
}

// ==================== 상품 표시 ====================
function displayItems(items) {
  const tbody = document.getElementById('itemsTableBody');
  const itemCount = document.getElementById('itemCount');

  if (!tbody) return;

  itemCount.textContent = `전체 ${items.length}개`;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-message">
          등록된 상품이 없습니다.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items
    .map((item) => {
      const stockClass = getStockClass(item.stock_quantity);
      const statusBadge = item.is_active
        ? '<span class="badge badge-success">판매중</span>'
        : '<span class="badge badge-secondary">판매중지</span>';

      return `
      <tr>
        <td>
          <div class="item-image">
            ${item.image_url || '📦'}
          </div>
        </td>
        <td class="item-name">${item.name}</td>
        <td>${item.category || '기타'}</td>
        <td class="item-price">${item.price.toLocaleString()}P</td>
        <td class="item-stock ${stockClass}">
          ${item.stock_quantity}개
        </td>
        <td>${statusBadge}</td>
        <td class="action-buttons">
          <button class="btn-icon" onclick="editItem('${
            item.item_id
          }')" title="수정">
            ✏️
          </button>
          <button class="btn-icon" onclick="toggleItemStatus('${
            item.item_id
          }', ${item.is_active})" 
                  title="${item.is_active ? '판매중지' : '판매재개'}">
            ${item.is_active ? '⏸️' : '▶️'}
          </button>
          <button class="btn-icon delete" onclick="deleteItem('${
            item.item_id
          }')" title="삭제">
            🗑️
          </button>
        </td>
      </tr>
    `;
    })
    .join('');
}

// ==================== 재고 상태 클래스 ====================
function getStockClass(stock) {
  if (stock === 0) return 'stock-out';
  if (stock <= 10) return 'stock-low';
  return 'stock-ok';
}

// ==================== 필터링 ====================
function filterItems() {
  const category = document.getElementById('categoryFilter').value;
  const stockFilter = document.getElementById('stockFilter').value;
  const searchText = document.getElementById('searchInput').value.toLowerCase();

  filteredItems = shopItems.filter((item) => {
    // 카테고리 필터
    if (category && item.category !== category) return false;

    // 재고 필터
    if (stockFilter === 'available' && item.stock_quantity === 0) return false;
    if (
      stockFilter === 'low' &&
      (item.stock_quantity === 0 || item.stock_quantity > 10)
    )
      return false;
    if (stockFilter === 'out' && item.stock_quantity > 0) return false;

    // 검색어 필터
    if (searchText && !item.name.toLowerCase().includes(searchText))
      return false;

    return true;
  });

  displayItems(filteredItems);
}

// ==================== 모달 관리 ====================
function showAddItemModal() {
  currentEditId = null;
  document.getElementById('modalTitle').textContent = '새 상품 등록';
  document.getElementById('itemForm').reset();
  document.getElementById('itemActive').checked = true;
  document.getElementById('itemModal').classList.add('active');
}

function editItem(itemId) {
  const item = shopItems.find((i) => i.item_id === itemId);
  if (!item) return;

  currentEditId = itemId;
  document.getElementById('modalTitle').textContent = '상품 수정';

  // 폼 데이터 채우기
  document.getElementById('itemName').value = item.name;
  document.getElementById('itemCategory').value = item.category || '';
  document.getElementById('itemPrice').value = item.price;
  document.getElementById('itemStock').value = item.stock_quantity;
  document.getElementById('itemDescription').value = item.description || '';
  document.getElementById('itemImage').value = item.image_url || '';
  document.getElementById('itemActive').checked = item.is_active;

  // 이미지 미리보기 설정
  if (item.image_url) {
    showImagePreview(item.image_url);
    currentImageUrl = item.image_url;
  } else {
    removeImage();
  }

  document.getElementById('itemModal').classList.add('active');
}

function closeModal() {
  document.getElementById('itemModal').classList.remove('active');
  document.getElementById('itemForm').reset();
  currentEditId = null;
}

// ==================== 상품 저장 ====================
async function saveItem() {
  // 폼 데이터 수집
  const itemData = {
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value,
    price: parseInt(document.getElementById('itemPrice').value) || 0,
    stock_quantity: parseInt(document.getElementById('itemStock').value) || 0,
    description: document.getElementById('itemDescription').value.trim(),
    image_url: document.getElementById('itemImage').value.trim() || '📦',
    is_active: document.getElementById('itemActive').checked,
  };

  // 유효성 검사
  if (!itemData.name || !itemData.category || itemData.price <= 0) {
    toastr.warning('필수 항목을 모두 입력해주세요.', '알림');
    return;
  }

  try {
    if (currentEditId) {
      // 수정
      const { error } = await supabase
        .from('shop_items')
        .update(itemData)
        .eq('item_id', currentEditId);

      if (error) throw error;

      toastr.success('상품이 수정되었습니다.', '성공');
    } else {
      // 신규 등록
      itemData.item_id = 'ITEM' + Date.now();

      const { error } = await supabase.from('shop_items').insert(itemData);

      if (error) throw error;

      toastr.success('새 상품이 등록되었습니다.', '성공');
    }

    closeModal();
    await loadShopItems();
  } catch (error) {
    console.error('상품 저장 오류:', error);
    toastr.error('저장에 실패했습니다.', '오류');
  }
}

// ==================== 상품 상태 토글 ====================
async function toggleItemStatus(itemId, currentStatus) {
  const newStatus = !currentStatus;
  const action = newStatus ? '판매 재개' : '판매 중지';

  if (!confirm(`이 상품을 ${action}하시겠습니까?`)) return;

  try {
    const { error } = await supabase
      .from('shop_items')
      .update({ is_active: newStatus })
      .eq('item_id', itemId);

    if (error) throw error;

    toastr.success(`상품이 ${action}되었습니다.`, '성공');
    await loadShopItems();
  } catch (error) {
    console.error('상태 변경 오류:', error);
    toastr.error('상태 변경에 실패했습니다.', '오류');
  }
}

// ==================== 상품 삭제 ====================
async function deleteItem(itemId) {
  if (
    !confirm(
      '정말 이 상품을 삭제하시겠습니까?\n삭제된 상품은 복구할 수 없습니다.'
    )
  )
    return;

  try {
    const { error } = await supabase
      .from('shop_items')
      .delete()
      .eq('item_id', itemId);

    if (error) throw error;

    toastr.success('상품이 삭제되었습니다.', '성공');
    await loadShopItems();
  } catch (error) {
    console.error('삭제 오류:', error);
    toastr.error('삭제에 실패했습니다.', '오류');
  }
}

// ==================== 이모지 선택 ====================
function initializeEmojiGrid() {
  const emojiGrid = document.getElementById('emojiGrid');
  if (!emojiGrid) return;

  emojiGrid.innerHTML = EMOJI_LIST.map(
    (emoji) => `
    <button type="button" class="emoji-item" onclick="selectEmoji('${emoji}')">
      ${emoji}
    </button>
  `
  ).join('');
}

function showEmojiPicker() {
  document.getElementById('emojiModal').classList.add('active');
}

function closeEmojiModal() {
  document.getElementById('emojiModal').classList.remove('active');
}

function selectEmoji(emoji) {
  document.getElementById('itemImage').value = emoji;
  closeEmojiModal();
}

// ==================== 유틸리티 ====================
function logout() {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.clear();
    window.location.href = '../login.html';
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
