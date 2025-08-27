// shop-manage.js - 상점 관리 기능

// 전역 변수
let shopItems = [];
let filteredItems = [];
let currentEditId = null;
let currentImageUrl = null;
let storageAvailable = false;

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
  const userName = localStorage.getItem('userName');

  // 원장 권한 체크
  if (loginId !== 'ablemaster' && userRole !== 'principal') {
    alert('원장 권한이 필요합니다.');
    window.location.href = 'index.html';
    return;
  }

  // 사용자 정보 표시
  document.getElementById('teacherName').textContent = userName || '원장';
  document.getElementById('userRole').textContent = '원장';

  // 관리자 섹션 표시
  document.getElementById('adminSection').style.display = 'block';

  // Supabase Storage 버킷 확인
  storageAvailable = await ensureStorageBucket();

  // 데이터 로드
  await loadShopItems();

  // 이모지 그리드 초기화
  initializeEmojiGrid();

  // 이미지 업로드 이벤트 설정
  setupImageUpload(); // storageAvailable 체크 제거

  // Enter 키 검색 이벤트
  document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') filterItems();
  });
});

// ==================== 이미지 업로드 기능 ====================
function setupImageUpload() {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;

  // 클릭해서 파일 선택
  uploadArea.addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });

  // 드래그 앤 드롭
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      await uploadImage(files[0]);
    }
  });

  // 화면 캡처 붙여넣기 (Ctrl+V) - 전체 문서에서 감지
  document.addEventListener('paste', async (e) => {
    const modal = document.getElementById('itemModal');
    if (!modal || !modal.classList.contains('active')) return;

    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA')
    ) {
      if (activeElement.id !== 'itemImage') return;
    }

    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();

        const file = item.getAsFile();
        if (file) {
          console.log('화면 캡처 이미지 감지:', file.type);

          // storageAvailable 체크 제거하고 직접 업로드 시도
          await uploadImageDirect(file); // uploadImage 대신 새 함수 호출
          break;
        }
      }
    }
  });
}

// setupImageUpload 함수 밖에 정의
async function uploadImageDirect(file) {
  if (file.size > 2 * 1024 * 1024) {
    toastr.warning('이미지 크기는 2MB 이하여야 합니다.');
    return;
  }

  const uploadStatus = document.getElementById('uploadStatus');
  if (uploadStatus) {
    uploadStatus.style.display = 'block';
    uploadStatus.innerHTML = '⏳ 이미지 업로드 중...';
  }

  try {
    const fileName = `products/${Date.now()}_${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      '_'
    )}`;

    const { data, error } = await supabase.storage
      .from('shop-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(fileName);

    currentImageUrl = urlData.publicUrl;

    // 미리보기 표시
    showImagePreview(currentImageUrl);

    // URL 입력란에 표시
    document.getElementById('itemImage').value = currentImageUrl;

    if (uploadStatus) {
      uploadStatus.innerHTML = '✅ 업로드 완료!';
      setTimeout(() => {
        uploadStatus.style.display = 'none';
      }, 2000);
    }

    // 성공 메시지
    toastr.success('화면 캡처 이미지가 업로드되었습니다.');
  } catch (error) {
    console.error('이미지 업로드 오류:', error);

    if (uploadStatus) {
      uploadStatus.innerHTML = '❌ 업로드 실패';
    }

    toastr.error('이미지 업로드에 실패했습니다: ' + error.message);
  }
}

// 파일 선택 핸들러
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    await uploadImage(file);
  }
}

// 이미지 업로드 함수
// 이미지 업로드 함수 - 241번 줄 수정
async function uploadImage(file) {
  // storageAvailable 체크 제거
  // if (!storageAvailable) {
  //   toastr.warning(
  //     '이미지 업로드가 준비되지 않았습니다. 이모지를 사용해주세요.'
  //   );
  //   return;
  // }

  // 파일 크기 체크 (2MB)
  if (file.size > 2 * 1024 * 1024) {
    toastr.warning('이미지 크기는 2MB 이하여야 합니다.');
    return;
  }

  const uploadStatus = document.getElementById('uploadStatus');
  if (uploadStatus) {
    uploadStatus.style.display = 'block';
    uploadStatus.innerHTML = '⏳ 이미지 업로드 중...';
  }

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

    if (uploadStatus) {
      uploadStatus.innerHTML = '✅ 업로드 완료!';
      setTimeout(() => {
        uploadStatus.style.display = 'none';
      }, 2000);
    }

    // 성공 메시지 추가
    toastr.success('이미지가 업로드되었습니다.');
  } catch (error) {
    console.error('이미지 업로드 오류:', error);

    if (uploadStatus) {
      uploadStatus.innerHTML = '❌ 업로드 실패';
    }

    if (error.message?.includes('row-level security')) {
      toastr.error('Storage 정책 설정이 필요합니다. 관리자에게 문의하세요.');
    } else if (error.message?.includes('Bucket not found')) {
      toastr.error('이미지 저장소를 찾을 수 없습니다.');
    } else {
      toastr.error('이미지 업로드에 실패했습니다: ' + error.message);
    }
  }
}

// 이미지 미리보기 표시
function showImagePreview(url) {
  const previewContent = document.getElementById('previewContent');
  const removeBtn = document.querySelector('.btn-remove-image');

  if (!previewContent) return;

  if (url && url.startsWith('http')) {
    // URL 이미지
    previewContent.innerHTML = `
      <img src="${url}" alt="상품 이미지" 
           onerror="this.style.display='none'; this.parentElement.innerHTML='❌ 이미지 로드 실패';">
    `;
  } else if (url) {
    // 이모지
    previewContent.innerHTML = `<span class="preview-emoji">${url}</span>`;
  }

  if (removeBtn && url) {
    removeBtn.style.display = 'block';
  }
}

// 이미지 제거
function removeImage() {
  document.getElementById('previewContent').innerHTML =
    '<span class="preview-placeholder">📦</span>';
  document.getElementById('itemImage').value = '';
  document.querySelector('.btn-remove-image').style.display = 'none';
  currentImageUrl = null;
}

// ==================== ensureStorageBucket 수정 ====================
async function ensureStorageBucket() {
  // 버킷 확인을 건너뛰고 항상 true 반환
  // 실제 업로드 시 오류가 발생하면 그때 처리
  return true;
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
    toastr.error('상품을 불러오는데 실패했습니다.');
  }
}

// ==================== 상품 표시 ====================
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
      const stockClass = getStockClass(item.stock); // 이미 수정됨
      const statusBadge = item.is_active
        ? '<span class="badge badge-success">판매중</span>'
        : '<span class="badge badge-secondary">판매중지</span>';

      // 이미지 표시 처리
      let imageDisplay = '📦';
      if (item.image) {
        // 이미 수정됨
        if (item.image.startsWith('http')) {
          imageDisplay = `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
          imageDisplay = item.image;
        }
      }

      return `
      <tr>
        <td>
          <div class="item-image">
            ${imageDisplay}
          </div>
        </td>
        <td class="item-name">${item.name}</td>
        <td>${item.category || '기타'}</td>
        <td class="item-price">${item.price.toLocaleString()}P</td>
        <td class="item-stock ${stockClass}">
          ${item.stock}개
        </td>
        <td>${statusBadge}</td>
        <td class="action-buttons">
          <button class="btn-action btn-edit" onclick="editItem('${
            item.item_id
          }')" title="수정">
            수정
          </button>
          <button class="btn-action btn-toggle ${
            item.is_active ? 'btn-pause' : 'btn-play'
          }" 
                  onclick="toggleItemStatus('${item.item_id}', ${
        item.is_active
      })" 
                  title="${item.is_active ? '판매중지' : '판매재개'}">
            ${item.is_active ? '중지' : '재개'}
          </button>
          <button class="btn-action btn-delete" onclick="deleteItem('${
            item.item_id
          }')" title="삭제">
            삭제
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
    if (stockFilter === 'available' && item.stock === 0) return false;
    if (stockFilter === 'low' && (item.stock === 0 || item.stock > 10))
      return false;
    if (stockFilter === 'out' && item.stock > 0) return false;

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
  removeImage();
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
  document.getElementById('itemStock').value = item.stock; // stock_quantity → stock
  document.getElementById('itemDescription').value = item.description || '';
  document.getElementById('itemImage').value = item.image || ''; // image_url → image
  document.getElementById('itemActive').checked = item.is_active;

  // 이미지 미리보기 설정
  if (item.image) {
    // image_url → image
    showImagePreview(item.image);
    currentImageUrl = item.image;
  } else {
    removeImage();
  }

  document.getElementById('itemModal').classList.add('active');
}

function closeModal() {
  document.getElementById('itemModal').classList.remove('active');
  document.getElementById('itemForm').reset();
  removeImage();
  currentEditId = null;
}

// ==================== 상품 저장 ====================
async function saveItem() {
  // 폼 데이터 수집
  const itemData = {
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value,
    price: parseInt(document.getElementById('itemPrice').value) || 0,
    stock: parseInt(document.getElementById('itemStock').value) || 0, // stock_quantity → stock
    description: document.getElementById('itemDescription').value.trim(),
    image: document.getElementById('itemImage').value.trim() || '📦', // image_url → image
    is_active: document.getElementById('itemActive').checked,
  };

  // 디버깅을 위한 콘솔 로그 추가
  console.log('저장할 데이터:', itemData);

  // 유효성 검사 - 조건 수정
  if (!itemData.name) {
    toastr.warning('상품명을 입력해주세요.');
    return;
  }

  if (!itemData.category) {
    toastr.warning('카테고리를 선택해주세요.');
    return;
  }

  if (itemData.price <= 0) {
    toastr.warning('가격은 0보다 커야 합니다.');
    return;
  }

  try {
    if (currentEditId) {
      // 수정 로직
      const { error } = await supabase
        .from('shop_items')
        .update(itemData)
        .eq('item_id', currentEditId);

      if (error) throw error;
      toastr.success('상품이 수정되었습니다.');
    } else {
      // 신규 등록 - item_id 생성 방식 수정
      itemData.item_id = 'ITEM_' + Date.now();
      itemData.created_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('shop_items')
        .insert([itemData]) // 배열로 감싸기
        .select(); // 삽입된 데이터 반환

      if (error) throw error;

      console.log('저장 성공:', data);
      toastr.success('새 상품이 등록되었습니다.');
    }

    closeModal();
    await loadShopItems();
  } catch (error) {
    console.error('상품 저장 오류 상세:', error);
    toastr.error('저장에 실패했습니다: ' + error.message);
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

    toastr.success(`상품이 ${action}되었습니다.`);
    await loadShopItems();
  } catch (error) {
    console.error('상태 변경 오류:', error);
    toastr.error('상태 변경에 실패했습니다.');
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

    toastr.success('상품이 삭제되었습니다.');
    await loadShopItems();
  } catch (error) {
    console.error('삭제 오류:', error);
    toastr.error('삭제에 실패했습니다.');
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
  showImagePreview(emoji);
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
