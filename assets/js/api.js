// api.js - Supabase 연동 버전 (수정 완료)

// config.js가 로드되었는지 확인
if (!window.POINTBANK_CONFIG) {
  console.error(
    'Configuration not loaded. Please include config.js before api.js'
  );
  throw new Error('Configuration required');
}

// Supabase 클라이언트 초기화
const supabase = window.supabase.createClient(
  window.POINTBANK_CONFIG.supabase.url,
  window.POINTBANK_CONFIG.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-application-name': 'PointBank',
      },
    },
  }
);

// 디버그 로깅 함수
const debugLog = window.POINTBANK_CONFIG.debugLog;

/**
 * PointBank API 클래스
 * Supabase 테이블 구조에 맞게 완전히 재작성
 */
class PointBankAPI {
  constructor() {
    this.currentUser = null;
    debugLog('PointBank API initialized');
  }

  // ==================== 인증 관련 ====================

  /**
   * 현재 세션 체크
   */
  async checkSession() {
    debugLog('Checking session...');
    const userId = localStorage.getItem('userId');

    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        this.currentUser = data;
        debugLog('Session valid', { userId: data.user_id, role: data.role });
        return true;
      } else {
        debugLog('Session invalid', error);
      }
    }
    return false;
  }

  /**
   * 로그인
   */
  async login(loginId, password) {
    try {
      debugLog('Login attempt', { loginId });

      // users 테이블에서 사용자 조회
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginId)
        .eq('password', password) // 실제로는 해시 비교 필요
        .single();

      if (error) {
        debugLog('Login error', error);
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: '아이디 또는 비밀번호가 올바르지 않습니다.',
          };
        }
        throw error;
      }

      if (!user) {
        return {
          success: false,
          error: '아이디 또는 비밀번호가 올바르지 않습니다.',
        };
      }

      // 학생인 경우 students 테이블에서 포인트 정보 조회
      if (user.role === 'student') {
        const { data: studentInfo } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.user_id)
          .single();

        if (studentInfo) {
          user.currentPoints = studentInfo.current_points;
          user.totalPoints = studentInfo.total_points;
          user.savingsPoints = studentInfo.savings_points;
          user.level = studentInfo.level;
          user.studentId = studentInfo.student_id;
        }
      }

      this.currentUser = user;
      debugLog('Login successful', { userId: user.user_id, role: user.role });

      return {
        success: true,
        data: {
          userId: user.user_id,
          loginId: user.login_id,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          avatar: user.avatar,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      debugLog('Login failed', error);
      return {
        success: false,
        error: error.message || '로그인 처리 중 오류가 발생했습니다.',
      };
    }
  }

  // ==================== 학생 관련 ====================

  /**
   * 학생 목록 조회 (선생님용)
   */
  async getStudents(classId = null) {
    try {
      debugLog('Getting students', { classId });

      // student_details 뷰 활용
      let query = supabase.from('student_details').select('*').order('name');

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (error) {
        debugLog('Get students error', error);
        throw error;
      }

      debugLog('Students loaded', { count: data?.length || 0 });

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error('Get students error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 학생 포인트 조회
   */
  async getStudentPoints(loginId) {
    try {
      debugLog('Getting student points', { loginId });

      // student_details 뷰에서 조회 (login_id 사용)
      const { data, error } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', loginId)
        .single();

      if (error) {
        debugLog('Get student points error', error);
        throw error;
      }

      debugLog('Student points loaded', {
        studentId: data.student_id,
        points: data.current_points,
      });

      return {
        success: true,
        data: {
          studentId: data.student_id,
          name: data.name,
          currentPoints: data.current_points || 0,
          totalPoints: data.total_points || 0,
          savingsPoints: data.savings_points || 0,
          level: data.level || '씨앗',
          avatar: data.avatar || '🦁',
          classId: data.class_id,
        },
      };
    } catch (error) {
      console.error('Get student points error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 포인트 관련 ====================

  /**
   * 포인트 지급
   */
  async addPoints(loginId, amount, type, reason) {
    try {
      debugLog('Adding points', { loginId, amount, type, reason });

      // 1. student_details 뷰에서 학생 정보 조회
      const { data: studentDetail } = await supabase
        .from('student_details')
        .select('student_id, user_id, current_points, total_points')
        .eq('login_id', loginId)
        .single();

      if (!studentDetail) {
        throw new Error('학생을 찾을 수 없습니다.');
      }

      // 2. points 테이블에 거래 기록 추가
      const { error: pointsError } = await supabase.from('points').insert({
        transaction_id: this.generateId(),
        student_id: studentDetail.student_id,
        teacher_id: this.currentUser?.user_id,
        amount: parseInt(amount),
        type: type,
        reason: reason,
        created_at: new Date().toISOString(),
      });

      if (pointsError) {
        debugLog('Points insert error', pointsError);
        throw pointsError;
      }

      // 3. students 테이블 업데이트
      const newCurrentPoints =
        (studentDetail.current_points || 0) + parseInt(amount);
      const newTotalPoints =
        (studentDetail.total_points || 0) + parseInt(amount);

      const { error: updateError } = await supabase
        .from('students')
        .update({
          current_points: newCurrentPoints,
          total_points: newTotalPoints,
          level: this.calculateLevel(newTotalPoints),
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', studentDetail.student_id);

      if (updateError) {
        debugLog('Students update error', updateError);
        throw updateError;
      }

      debugLog('Points added successfully', { loginId, amount });
      return { success: true };
    } catch (error) {
      console.error('Add points error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 포인트 내역 조회
   */
  async getPointHistory(loginId) {
    try {
      debugLog('Getting point history', { loginId });

      // student_details에서 student_id 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('student_id')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // points 테이블에서 내역 조회
      const { data, error } = await supabase
        .from('points')
        .select('*')
        .eq('student_id', student.student_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        debugLog('Point history error', error);
        throw error;
      }

      debugLog('Point history loaded', { count: data?.length || 0 });

      return {
        success: true,
        data: data.map((item) => ({
          date: item.created_at,
          type: item.type,
          amount: item.amount,
          reason: item.reason,
        })),
      };
    } catch (error) {
      console.error('Get point history error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 저축 관련 ====================

  /**
   * 저축 입금
   */
  async deposit(loginId, amount) {
    try {
      debugLog('Processing deposit', { loginId, amount });

      // 1. 학생 정보 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      if (student.current_points < amount) {
        throw new Error('포인트가 부족합니다.');
      }

      // 2. savings 테이블 확인/업데이트
      const { data: existingSavings } = await supabase
        .from('savings')
        .select('*')
        .eq('student_id', student.student_id)
        .single();

      const newBalance = (existingSavings?.balance || 0) + parseInt(amount);

      if (existingSavings) {
        // 기존 저축 계좌 업데이트
        const { error: savingsError } = await supabase
          .from('savings')
          .update({
            balance: newBalance,
            last_interest_date: new Date().toISOString(),
          })
          .eq('savings_id', existingSavings.savings_id);

        if (savingsError) throw savingsError;
      } else {
        // 새 저축 계좌 생성
        const { error: savingsError } = await supabase.from('savings').insert({
          savings_id: this.generateId(),
          student_id: student.student_id,
          balance: parseInt(amount),
          interest_rate: 2.0,
          created_at: new Date().toISOString(),
        });

        if (savingsError) throw savingsError;
      }

      // 3. transactions 테이블에 기록
      const { error: transError } = await supabase.from('transactions').insert({
        transaction_id: this.generateId(),
        student_id: student.student_id,
        type: 'deposit',
        amount: parseInt(amount),
        created_at: new Date().toISOString(),
        status: 'completed',
      });

      if (transError) {
        debugLog('Transaction error', transError);
        throw transError;
      }

      // 4. students 테이블 업데이트
      const { error: updateError } = await supabase
        .from('students')
        .update({
          current_points: student.current_points - parseInt(amount),
          savings_points: (student.savings_points || 0) + parseInt(amount),
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', student.student_id);

      if (updateError) {
        debugLog('Students update error', updateError);
        throw updateError;
      }

      debugLog('Deposit successful', { loginId, amount, newBalance });
      return { success: true };
    } catch (error) {
      console.error('Deposit error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 저축 출금
   */
  async withdraw(loginId, amount) {
    try {
      debugLog('Processing withdrawal', { loginId, amount });

      // 1. 학생 정보 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      if (student.savings_points < amount) {
        throw new Error('저축 포인트가 부족합니다.');
      }

      // 2. savings 테이블 업데이트
      const { data: savings } = await supabase
        .from('savings')
        .select('*')
        .eq('student_id', student.student_id)
        .single();

      if (!savings || savings.balance < amount) {
        throw new Error('저축 잔액이 부족합니다.');
      }

      const newBalance = savings.balance - parseInt(amount);

      const { error: savingsError } = await supabase
        .from('savings')
        .update({
          balance: newBalance,
        })
        .eq('savings_id', savings.savings_id);

      if (savingsError) throw savingsError;

      // 3. transactions 테이블에 기록
      const { error: transError } = await supabase.from('transactions').insert({
        transaction_id: this.generateId(),
        student_id: student.student_id,
        type: 'withdraw',
        amount: parseInt(amount),
        created_at: new Date().toISOString(),
        status: 'completed',
      });

      if (transError) {
        debugLog('Transaction error', transError);
        throw transError;
      }

      // 4. students 테이블 업데이트
      const { error: updateError } = await supabase
        .from('students')
        .update({
          current_points: student.current_points + parseInt(amount),
          savings_points: student.savings_points - parseInt(amount),
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', student.student_id);

      if (updateError) {
        debugLog('Students update error', updateError);
        throw updateError;
      }

      debugLog('Withdrawal successful', { loginId, amount, newBalance });
      return { success: true };
    } catch (error) {
      console.error('Withdraw error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 저축 내역 조회
   */
  async getSavingsHistory(loginId) {
    try {
      debugLog('Getting savings history', { loginId });

      // student_details에서 student_id 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('student_id')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // transactions 테이블에서 저축 관련 내역만 조회
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('student_id', student.student_id)
        .in('type', ['deposit', 'withdraw', 'interest'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        debugLog('Savings history error', error);
        throw error;
      }

      // savings 테이블에서 현재 잔액 조회
      const { data: savings } = await supabase
        .from('savings')
        .select('balance')
        .eq('student_id', student.student_id)
        .single();

      debugLog('Savings history loaded', { count: data?.length || 0 });

      return {
        success: true,
        data: data.map((item) => ({
          type: item.type,
          amount: item.amount,
          date: item.created_at,
          balance: savings?.balance || 0,
        })),
      };
    } catch (error) {
      console.error('Get savings history error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 상점 관련 ====================

  /**
   * 상품 목록 조회
   */
  async getShopItems() {
    try {
      debugLog('Getting shop items');

      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('category, price');

      if (error) {
        debugLog('Shop items error', error);
        throw error;
      }

      debugLog('Shop items loaded', { count: data?.length || 0 });

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error('Get shop items error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 상품 구매
   */
  async purchaseItem(loginId, itemId) {
    try {
      debugLog('Processing purchase', { loginId, itemId });

      // 1. 학생 정보 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // 2. 상품 정보 조회
      const { data: item } = await supabase
        .from('shop_items')
        .select('*')
        .eq('item_id', itemId)
        .single();

      if (!item || item.stock <= 0) {
        throw new Error('상품이 품절되었습니다.');
      }

      if (student.current_points < item.price) {
        throw new Error('포인트가 부족합니다.');
      }

      // 3. transactions 테이블에 구매 기록
      const { error: purchaseError } = await supabase
        .from('transactions')
        .insert({
          transaction_id: this.generateId(),
          student_id: student.student_id,
          type: 'purchase',
          amount: -item.price, // 구매는 음수
          item_id: item.item_id,
          item_name: item.name,
          created_at: new Date().toISOString(),
          status: 'completed',
        });

      if (purchaseError) {
        debugLog('Purchase insert error', purchaseError);
        throw purchaseError;
      }

      // 4. students 테이블 포인트 차감
      const { error: pointError } = await supabase
        .from('students')
        .update({
          current_points: student.current_points - item.price,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', student.student_id);

      if (pointError) {
        debugLog('Points update error', pointError);
        throw pointError;
      }

      // 5. shop_items 테이블 재고 감소
      const { error: stockError } = await supabase
        .from('shop_items')
        .update({
          stock: item.stock - 1,
        })
        .eq('item_id', item.item_id);

      if (stockError) {
        debugLog('Stock update error', stockError);
        throw stockError;
      }

      debugLog('Purchase successful', { loginId, itemId, price: item.price });
      return { success: true };
    } catch (error) {
      console.error('Purchase item error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 거래 내역 통합 ====================

  /**
   * 전체 거래 내역 조회 (포인트 + 저축 + 구매)
   */
  async getTransactionHistory(loginId) {
    try {
      debugLog('Getting transaction history', { loginId });

      // student_details에서 student_id 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('student_id')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // transactions 테이블에서 모든 거래 조회
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, shop_items!item_id(name)')
        .eq('student_id', student.student_id)
        .order('created_at', { ascending: false })
        .limit(100);

      debugLog('Transaction history loaded', {
        count: transactions?.length || 0,
      });

      return {
        success: true,
        data: transactions.map((t) => ({
          type: t.type,
          amount: t.amount,
          itemName:
            t.item_name || t.shop_items?.name || this.getDefaultTitle(t.type),
          createdAt: t.created_at,
        })),
      };
    } catch (error) {
      console.error('Get transaction history error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 랭킹 관련 ====================

  /**
   * 랭킹 조회
   */
  async getRanking(classId = null) {
    try {
      debugLog('Getting ranking', { classId });

      // student_ranking 뷰 활용
      let query = supabase
        .from('student_ranking')
        .select('*')
        .order('rank')
        .limit(50);

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (error) {
        debugLog('Ranking error', error);
        throw error;
      }

      debugLog('Ranking loaded', { count: data?.length || 0 });

      return {
        success: true,
        data: data.map((student) => ({
          rank: student.rank,
          studentId: student.student_id,
          name: student.name,
          currentPoints: student.current_points || 0,
          totalPoints: student.total_points || 0,
          level: student.level || '씨앗',
          avatar: student.avatar || '🦁',
          classId: student.class_id,
        })),
      };
    } catch (error) {
      console.error('Get ranking error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 주간 랭킹 조회
   */
  async getWeeklyRanking() {
    try {
      debugLog('Getting weekly ranking');

      // weekly_ranking 뷰 활용
      const { data, error } = await supabase
        .from('weekly_ranking')
        .select('*')
        .order('rank')
        .limit(50);

      if (error) {
        debugLog('Weekly ranking error', error);
        throw error;
      }

      debugLog('Weekly ranking loaded', { count: data?.length || 0 });

      return {
        success: true,
        data: data.map((student) => ({
          rank: student.rank,
          studentId: student.student_id,
          name: student.name,
          weeklyPoints: student.weekly_points || 0,
          classId: student.class_id,
        })),
      };
    } catch (error) {
      console.error('Get weekly ranking error:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== 헬퍼 함수 ====================

  /**
   * 레벨 계산
   */
  calculateLevel(totalPoints) {
    if (totalPoints >= 50000) return '다이아몬드';
    if (totalPoints >= 30000) return '별';
    if (totalPoints >= 5000) return '큰나무';
    if (totalPoints >= 3000) return '나무';
    if (totalPoints >= 1000) return '새싹';
    return '씨앗';
  }

  /**
   * 기본 제목 가져오기
   */
  getDefaultTitle(type) {
    const titles = {
      attendance: '출석 보상',
      homework: '숙제 완료',
      test: '시험 점수',
      purchase: '상품 구매',
      deposit: '저축 입금',
      withdraw: '저축 출금',
      interest: '이자 지급',
      gift: '포인트 선물',
      manual: '수동 지급',
    };
    return titles[type] || type;
  }

  /**
   * 고유 ID 생성
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 에러 처리 헬퍼
   */
  handleError(error) {
    // PostgreSQL 에러 코드별 처리
    const errorMessages = {
      23505: '중복된 데이터입니다.',
      23503: '참조하는 데이터가 없습니다.',
      23502: '필수 항목이 누락되었습니다.',
      '22P02': '잘못된 입력 형식입니다.',
      PGRST116: '데이터를 찾을 수 없습니다.',
    };

    const message =
      errorMessages[error.code] ||
      error.message ||
      '처리 중 오류가 발생했습니다.';

    debugLog('Error handled', { code: error.code, message });
    return message;
  }
}

// API 인스턴스 생성
const api = new PointBankAPI();

// 개발 환경에서만 전역 객체로 노출 (디버깅용)
if (window.POINTBANK_CONFIG.env === 'development') {
  window.api = api;
  window.supabase = supabase;
  console.log('🔧 Development mode: api and supabase available in console');

  // 테스트용 헬퍼 함수들
  window.testAPI = {
    // 로그인 테스트
    testLogin: async () => {
      const result = await api.login('S001', '1234');
      console.log('Login test:', result);
      return result;
    },

    // 포인트 조회 테스트
    testGetPoints: async (loginId) => {
      const result = await api.getStudentPoints(loginId || 'S001');
      console.log('Get points test:', result);
      return result;
    },

    // 포인트 지급 테스트
    testAddPoints: async () => {
      const result = await api.addPoints('S001', 100, 'test', '테스트 지급');
      console.log('Add points test:', result);
      return result;
    },

    // 저축 입금 테스트
    testDeposit: async () => {
      const result = await api.deposit('S001', 100);
      console.log('Deposit test:', result);
      return result;
    },

    // 랭킹 조회 테스트
    testRanking: async () => {
      const result = await api.getRanking();
      console.log('Ranking test:', result);
      return result;
    },
  };

  console.log('📝 Test functions available:');
  console.log('- testAPI.testLogin()');
  console.log('- testAPI.testGetPoints(loginId)');
  console.log('- testAPI.testAddPoints()');
  console.log('- testAPI.testDeposit()');
  console.log('- testAPI.testRanking()');
}

// 전역 에러 핸들러
window.addEventListener('unhandledrejection', (event) => {
  debugLog('Unhandled API error', event.reason);

  // 프로덕션에서는 사용자에게 친화적인 메시지 표시
  if (window.POINTBANK_CONFIG.env === 'production') {
    console.error('API 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
});

// 네트워크 상태 체크
window.addEventListener('online', () => {
  debugLog('Network online');
  // 필요시 재연결 로직
});

window.addEventListener('offline', () => {
  debugLog('Network offline');
  console.warn('네트워크 연결이 끊어졌습니다.');
});
