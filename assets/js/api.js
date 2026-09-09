// api.js - Supabase 연동 버전 (수정 완료)

// config.js가 로드되었는지 확인
if (!window.POINTBANK_CONFIG) {
  console.error(
    'Configuration not loaded. Please include config.js before api.js'
  );
  throw new Error('Configuration required');
}

// Supabase 클라이언트 초기화 (중복 선언 방지)
var supabase;
if (!window.supabaseClient) {
  window.supabaseClient = window.supabase.createClient(
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
}
supabase = window.supabaseClient;

// ✅ debugLog는 이미 config.js에서 전역으로 선언되어 있으므로 직접 사용
// const debugLog = window.POINTBANK_CONFIG.debugLog;  // 삭제됨!

/**
 * PointBank API 클래스
 * Supabase 테이블 구조에 맞게 완전히 재작성
 */
class PointBankAPI {
  constructor() {
    this.currentUser = null;
    window.POINTBANK_CONFIG.debugLog('PointBank API initialized');
  }

  // ==================== 인증 관련 ====================

  /**
   * 🔒 서버에서 현재 사용자의 역할 검증
   * localStorage는 조작 가능하므로 DB에서 직접 확인
   */
  async verifyUserRole(requiredRoles = ['teacher', 'principal']) {
    try {
      const loginId = localStorage.getItem('loginId');
      if (!loginId) {
        return { success: false, error: '로그인이 필요합니다.', role: null };
      }

      // DB에서 실제 역할 조회
      const { data: user, error } = await supabase
        .from('users')
        .select('user_id, role, is_active')
        .eq('login_id', loginId)
        .single();

      if (error || !user) {
        return { success: false, error: '사용자를 찾을 수 없습니다.', role: null };
      }

      if (user.is_active === false) {
        return { success: false, error: '비활성화된 계정입니다.', role: null };
      }

      const hasPermission = requiredRoles.includes(user.role);

      return {
        success: hasPermission,
        error: hasPermission ? null : '권한이 없습니다.',
        role: user.role,
        userId: user.user_id
      };
    } catch (error) {
      console.error('역할 검증 오류:', error);
      return { success: false, error: '권한 확인 중 오류가 발생했습니다.', role: null };
    }
  }

  /**
   * 현재 세션 체크
   */
  async checkSession() {
    window.POINTBANK_CONFIG.debugLog('Checking session...');
    const userId = localStorage.getItem('userId');

    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        this.currentUser = data;
        window.POINTBANK_CONFIG.debugLog('Session valid', {
          userId: data.user_id,
          role: data.role,
        });
        return true;
      } else {
        window.POINTBANK_CONFIG.debugLog('Session invalid', error);
      }
    }
    return false;
  }

  /**
   * 로그인
   */
  async login(loginId, password) {
    try {
      // 입력값 앞뒤 공백/탭/개행 제거 (계정 조회 실패 방지)
      const cleanLoginId = (loginId || '').trim();
      window.POINTBANK_CONFIG.debugLog('Login attempt', {
        loginId: cleanLoginId,
      });

      // users 테이블에서 사용자 조회
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', cleanLoginId)
        .eq('password', password) // 실제로는 해시 비교 필요
        .single();

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Login error', error);
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
      window.POINTBANK_CONFIG.debugLog('Login successful', {
        userId: user.user_id,
        role: user.role,
      });

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
      window.POINTBANK_CONFIG.debugLog('Login failed', error);
      return {
        success: false,
        error: error.message || '로그인 처리 중 오류가 발생했습니다.',
      };
    }
  }

  // ==================== 학생 관련 ====================

  // ==================== getStudents 함수 - 휴원생 필터링 버전 ====================

  /**
   * 학생 목록 조회 - 활성 학생만 표시
   * users 테이블에서 is_active 확인 후 필터링
   * 🔒 teacher/principal 권한 필요
   */
  async getStudents(classId = null) {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting students', { classId });

      // 🔒 권한 검증
      const roleCheck = await this.verifyUserRole(['teacher', 'principal']);
      if (!roleCheck.success) {
        console.warn('getStudents 권한 없음:', roleCheck.error);
        return { success: false, error: roleCheck.error, data: [] };
      }

      // 1. student_details에서 전체 학생 조회 (classes 테이블 조인하여 class_name 가져오기)
      let query = supabase
        .from('student_details')
        .select('*, classes(class_name, class_code)')
        .order('name');

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Get students error', error);
        throw error;
      }

      // 2. users 테이블에서 is_active 정보 조회
      const userIds = (data || []).map((s) => s.user_id).filter(Boolean);

      let activeUserIds = new Set();

      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('user_id, is_active')
          .in('user_id', userIds)
          .eq('is_active', true); // ✅ 활성 사용자만 조회

        if (users) {
          activeUserIds = new Set(users.map((u) => u.user_id));
        }
      }

      // 3. 활성 학생만 필터링
      const activeStudents = (data || []).filter((student) =>
        activeUserIds.has(student.user_id)
      );

      window.POINTBANK_CONFIG.debugLog('Active students loaded', {
        total: data?.length || 0,
        active: activeStudents.length,
      });

      // 4. 카멜케이스 변환 후 반환
      return {
        success: true,
        data: activeStudents.map((student) => ({
          studentId: student.student_id,
          userId: student.user_id,
          name: student.name,
          loginId: student.login_id,
          classId: student.class_id,
          // class_name을 조인된 classes 테이블 또는 기존 필드에서 가져오기
          className: student.classes?.class_name || student.class_name || '-',
          level: student.level || '씨앗',
          currentPoints: student.current_points || 0,
          totalPoints: student.total_points || 0,
          savingsPoints: student.savings_points || 0,
          avatar: student.avatar || '🦁',
          phone: student.phone,
          parentPhone: student.parent_phone,
          grade: student.grade,
          createdAt: student.created_at,
          isActive: true, // 활성 학생만 있으므로 true
          status: 'active',
        })),
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
      window.POINTBANK_CONFIG.debugLog('Getting student points', { loginId });

      // student_details 뷰에서 조회 (login_id 사용)
      const { data, error } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', loginId)
        .single();

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Get student points error', error);
        throw error;
      }

      window.POINTBANK_CONFIG.debugLog('Student points loaded', {
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
          className: data.class_name, // 추가 정보
          grade: data.grade, // 추가 정보
        },
      };
    } catch (error) {
      console.error('Get student points error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🆕 여기에 getStudentInfo() 메서드 추가
   */
  async getStudentInfo(loginId) {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting student info', { loginId });

      const { data: student, error } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', loginId)
        .single();

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Student info error', error);
        throw error;
      }

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      return {
        success: true,
        data: {
          studentId: student.student_id,
          userId: student.user_id,
          name: student.name,
          loginId: student.login_id,
          currentPoints: student.current_points || 0,
          totalPoints: student.total_points || 0,
          savingsPoints: student.savings_points || 0,
          level: student.level || '씨앗',
          avatar: student.avatar || '🦁',
        },
      };
    } catch (error) {
      console.error('Get student info error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 학생 상태 변경 - 휴원/퇴원 처리
   */
  async updateStudentStatus(studentId, status, reason = '') {
    try {
      // status에 따라 is_active 설정
      const isActive = status === 'active';

      const { data, error } = await supabase
        .from('users')
        .update({
          status: status,
          is_active: isActive, // 기존 컬럼 활용
          status_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', studentId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('상태 변경 오류:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 로그인 시 계정 상태 확인
   */
  async checkAccountStatus(loginId) {
    try {
      // 입력값 앞뒤 공백/탭/개행 제거 (계정 조회 실패 방지)
      const cleanLoginId = (loginId || '').trim();

      const { data, error } = await supabase
        .from('users')
        .select('is_active, status')
        .eq('login_id', cleanLoginId)
        .maybeSingle();

      if (error) throw error;

      // 일치하는 계정이 없는 경우
      if (!data) {
        return {
          success: false,
          message: '등록되지 않은 아이디입니다.',
        };
      }

      // is_active가 false면 로그인 차단
      if (!data.is_active) {
        const message =
          data.status === 'inactive'
            ? '휴원 중인 계정입니다.'
            : '퇴원한 계정입니다.';
        return {
          success: false,
          message: message,
        };
      }

      return { success: true };
    } catch (error) {
      console.error('계정 상태 확인 오류:', error);
      // catch 블록도 message로 반환 (login.html이 message를 표시)
      return {
        success: false,
        message: '계정 확인 중 오류가 발생했습니다. 관리자에게 문의하세요.',
      };
    }
  }

  // ==================== 포인트 관련 ====================

  /**
   * 포인트 지급
   * 🔒 teacher/principal 권한 필요
   */
  async addPoints(loginId, amount, type, reason) {
    try {
      window.POINTBANK_CONFIG.debugLog('Adding points', {
        loginId,
        amount,
        type,
        reason,
      });

      // 🔒 권한 검증 - 포인트 지급은 반드시 teacher/principal만 가능
      const roleCheck = await this.verifyUserRole(['teacher', 'principal']);
      if (!roleCheck.success) {
        console.error('addPoints 권한 없음:', roleCheck.error);
        return { success: false, error: '포인트 지급 권한이 없습니다.' };
      }

      // student_details 뷰에서 직접 조회 (개선됨)
      const { data: studentDetail } = await supabase
        .from('student_details')
        .select('student_id, user_id, current_points, total_points')
        .eq('login_id', loginId) // ✅ 이제 작동함!
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
        window.POINTBANK_CONFIG.debugLog('Points insert error', pointsError);
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
        window.POINTBANK_CONFIG.debugLog('Students update error', updateError);
        throw updateError;
      }

      window.POINTBANK_CONFIG.debugLog('Points added successfully', {
        loginId,
        amount,
      });
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
      window.POINTBANK_CONFIG.debugLog('Getting point history', { loginId });

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
        window.POINTBANK_CONFIG.debugLog('Point history error', error);
        throw error;
      }

      window.POINTBANK_CONFIG.debugLog('Point history loaded', {
        count: data?.length || 0,
      });

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
      window.POINTBANK_CONFIG.debugLog('Processing deposit', {
        loginId,
        amount,
      });

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

      // 2. transactions 테이블에 기록
      await supabase.from('transactions').insert({
        transaction_id: this.generateId(),
        student_id: student.student_id,
        type: 'deposit',
        amount: parseInt(amount),
        created_at: new Date().toISOString(),
        status: 'completed',
      });

      // 3. students 테이블만 업데이트
      await supabase
        .from('students')
        .update({
          current_points: student.current_points - parseInt(amount),
          savings_points: (student.savings_points || 0) + parseInt(amount),
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', student.student_id);

      window.POINTBANK_CONFIG.debugLog('Deposit successful', {
        loginId,
        amount,
      });

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
      // 1. 학생 정보 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // 2. students.savings_points만 사용 (savings 테이블 무시)
      if (student.savings_points < amount) {
        throw new Error('저축 잔액이 부족합니다.');
      }

      // 3. transactions 기록
      await supabase.from('transactions').insert({
        transaction_id: this.generateId(),
        student_id: student.student_id,
        type: 'withdraw',
        amount: parseInt(amount),
        created_at: new Date().toISOString(),
        status: 'completed',
      });

      // 4. students 테이블 업데이트
      await supabase
        .from('students')
        .update({
          current_points: student.current_points + parseInt(amount),
          savings_points: student.savings_points - parseInt(amount),
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', student.student_id);

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
      window.POINTBANK_CONFIG.debugLog('Getting savings history', { loginId });

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
        window.POINTBANK_CONFIG.debugLog('Savings history error', error);
        throw error;
      }

      // savings 테이블에서 현재 잔액 조회
      const { data: savings } = await supabase
        .from('savings')
        .select('balance')
        .eq('student_id', student.student_id)
        .single();

      window.POINTBANK_CONFIG.debugLog('Savings history loaded', {
        count: data?.length || 0,
      });

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
      window.POINTBANK_CONFIG.debugLog('Getting shop items');

      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('category, price');

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Shop items error', error);
        throw error;
      }

      window.POINTBANK_CONFIG.debugLog('Shop items loaded', {
        count: data?.length || 0,
      });

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
      window.POINTBANK_CONFIG.debugLog('Processing purchase', {
        loginId,
        itemId,
      });

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
        window.POINTBANK_CONFIG.debugLog(
          'Purchase insert error',
          purchaseError
        );
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
        window.POINTBANK_CONFIG.debugLog('Points update error', pointError);
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
        window.POINTBANK_CONFIG.debugLog('Stock update error', stockError);
        throw stockError;
      }

      window.POINTBANK_CONFIG.debugLog('Purchase successful', {
        loginId,
        itemId,
        price: item.price,
      });
      return { success: true };
    } catch (error) {
      console.error('Purchase item error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🆕 여기에 getPurchaseHistory() 메서드 추가
   */
  async getPurchaseHistory(loginId, limit = 10) {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting purchase history', {
        loginId,
        limit,
      });

      // 학생 정보 조회
      const { data: student } = await supabase
        .from('student_details')
        .select('student_id')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // 구매 내역 + 상품 정보 조인
      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          *,
          shop_items (
            name,
            emoji,
            image_url,
            category
          )
        `
        )
        .eq('student_id', student.student_id)
        .eq('type', 'purchase')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Purchase history error', error);
        throw error;
      }

      return {
        success: true,
        data: data
          ? data.map((item) => ({
              id: item.id,
              item_name: item.shop_items?.name || item.item_name,
              price: Math.abs(item.amount),
              created_at: item.created_at,
              emoji: item.shop_items?.emoji || '🎁',
              image_url: item.shop_items?.image_url || null,
              category: item.shop_items?.category || 'unknown',
            }))
          : [],
      };
    } catch (error) {
      console.error('Get purchase history error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🆕 여기에 checkWeeklyPurchaseLimit() 메서드 추가
   /**
/**
 * 주간 구매 제한 확인 (더 엄격한 버전)
 */
  // api.js에서 checkWeeklyPurchaseLimit 함수 수정
  async checkWeeklyPurchaseLimit(studentId) {
    try {
      console.log(`[구매제한체크] 학생ID: ${studentId} 확인 시작`);

      // 한국 시간 기준으로 정확한 주차 계산
      const now = new Date();
      const kstOffset = 9 * 60; // KST는 UTC+9
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const kstTime = new Date(utcTime + kstOffset * 60000);

      const currentDay = kstTime.getDay();
      const currentHour = kstTime.getHours();

      // 월요일 9시를 기준으로 주의 시작 계산
      let weekStart = new Date(kstTime);
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      weekStart.setDate(kstTime.getDate() - daysFromMonday);
      weekStart.setHours(9, 0, 0, 0);

      // 현재가 월요일 9시 이전이면 이전 주로 설정
      if (kstTime < weekStart) {
        weekStart.setDate(weekStart.getDate() - 7);
      }

      console.log(`[구매제한체크] 주 시작 시간: ${weekStart.toISOString()}`);
      console.log(`[구매제한체크] 현재 KST: ${kstTime.toISOString()}`);

      // 이번 주 구매 내역 조회
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('student_id', studentId)
        .eq('type', 'purchase')
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[구매제한체크] DB 오류:', error);
        // 오류 시 안전하게 구매 차단
        return {
          canPurchase: false,
          purchaseCount: 0,
          remainingPurchases: 0,
          message: '구매 제한 확인 중 오류가 발생했습니다.',
        };
      }

      const purchaseCount = data ? data.length : 0;
      const maxPurchases = 1; // 주당 1회 제한

      console.log(
        `[구매제한체크] 이번 주 구매 횟수: ${purchaseCount}/${maxPurchases}`
      );

      if (data && data.length > 0) {
        console.log('[구매제한체크] 최근 구매 내역:', {
          item: data[0].item_name,
          date: data[0].created_at,
        });
      }

      return {
        canPurchase: purchaseCount < maxPurchases,
        purchaseCount: purchaseCount,
        remainingPurchases: Math.max(0, maxPurchases - purchaseCount),
        lastPurchase: data && data[0] ? data[0] : null,
        weekStart: weekStart.toISOString(),
        message:
          purchaseCount >= maxPurchases
            ? '이번 주 구매 횟수를 모두 사용했습니다.'
            : `이번 주 ${maxPurchases - purchaseCount}회 구매 가능합니다.`,
      };
    } catch (error) {
      console.error('[구매제한체크] 예외 발생:', error);
      // 예외 발생 시 안전하게 구매 차단
      return {
        canPurchase: false,
        purchaseCount: 0,
        remainingPurchases: 0,
        message: '시스템 오류가 발생했습니다.',
      };
    }
  }

  // ==================== 구매 관리용 함수들 ====================

  /**
   * 모든 구매 내역 조회 (구매 관리용)
   * 🔒 teacher/principal 권한 필요
   */
  async getAllPurchases() {
    try {
      // 🔒 권한 검증
      const roleCheck = await this.verifyUserRole(['teacher', 'principal']);
      if (!roleCheck.success) {
        console.warn('getAllPurchases 권한 없음:', roleCheck.error);
        return { success: false, error: roleCheck.error, data: [] };
      }

      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          *,
          shop_items (
            name,
            image,
            category
          )
        `
        )
        .eq('type', 'purchase')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 학생 정보는 별도로 조회 (student_details 뷰 사용)
      const studentIds = [...new Set(data.map((item) => item.student_id))];
      const { data: students } = await supabase
        .from('student_details')
        .select('student_id, name, login_id, avatar, class_name')
        .in('student_id', studentIds);

      const studentsMap = new Map(
        students?.map((s) => [s.student_id, s]) || []
      );

      // 데이터 정규화
      const normalizedData = data.map((item) => {
        const student = studentsMap.get(item.student_id);

        return {
          transaction_id: item.transaction_id,
          student_id: item.student_id,
          studentId: item.student_id,
          studentName: student?.name || '알 수 없는 학생',
          studentClass: student?.class_name || '',
          studentAvatar: student?.avatar || '🦁',
          item_id: item.item_id,
          itemId: item.item_id,
          itemName:
            item.shop_items?.name || item.item_name || '알 수 없는 상품',
          item_name:
            item.shop_items?.name || item.item_name || '알 수 없는 상품',
          price: Math.abs(item.amount),
          amount: Math.abs(item.amount),
          image_url: item.shop_items?.image || null,
          category: item.shop_items?.category || null,
          created_at: item.created_at,
          delivery_status: item.delivery_status || 'pending',
          delivered_by: item.delivered_by,
          delivered_at: item.delivered_at,
          delivery_notes: item.delivery_notes,
          type: item.type,
        };
      });

      return {
        success: true,
        data: normalizedData,
      };
    } catch (error) {
      console.error('모든 구매 내역 조회 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 구매 지급 처리 (delivered로 상태 변경)
   * 🔒 teacher/principal 권한 필요
   */
  async markAsDelivered(transactionId, teacherId, teacherName, notes = '') {
    try {
      // 🔒 권한 검증
      const roleCheck = await this.verifyUserRole(['teacher', 'principal']);
      if (!roleCheck.success) {
        console.error('markAsDelivered 권한 없음:', roleCheck.error);
        return { success: false, error: '지급 처리 권한이 없습니다.' };
      }

      console.log('지급처리 시도:', { transactionId, teacherId, teacherName }); // 디버깅용

      const { data, error } = await supabase
        .from('transactions')
        .update({
          delivery_status: 'delivered',
          delivered_by: teacherName || teacherId,
          delivered_at: new Date().toISOString(),
          delivery_notes: notes,
        })
        .eq('transaction_id', transactionId)
        .select();

      if (error) throw error;

      // ⭐ 중요: data가 비어있으면 업데이트 실패!
      if (!data || data.length === 0) {
        console.error('업데이트된 row가 없음. transaction_id:', transactionId);
        return {
          success: false,
          error: `거래 ID ${transactionId}를 찾을 수 없습니다.`,
        };
      }

      console.log('지급처리 성공:', data[0]); // 디버깅용
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('지급 처리 실패:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 미지급 구매 개수 조회 (대시보드용)
   */
  async getPendingPurchasesCount() {
    try {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'purchase')
        .eq('delivery_status', 'pending');

      if (error) throw error;

      return {
        success: true,
        data: { count: count || 0 },
      };
    } catch (error) {
      console.error('미지급 구매 개수 조회 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 오늘 지급된 구매 개수 조회
   */
  async getTodayDeliveredCount() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'purchase')
        .eq('delivery_status', 'delivered')
        .gte('delivered_at', today.toISOString())
        .lt('delivered_at', tomorrow.toISOString());

      if (error) throw error;

      return {
        success: true,
        data: { count: count || 0 },
      };
    } catch (error) {
      console.error('오늘 지급 개수 조회 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 구매 통계 조회 (관리자용)
   */
  async getPurchaseStats(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          *,
          shop_items (name, category)
        `
        )
        .eq('type', 'purchase')
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      const stats = {
        totalPurchases: data.length,
        pendingCount: data.filter((item) => item.delivery_status === 'pending')
          .length,
        deliveredCount: data.filter(
          (item) => item.delivery_status === 'delivered'
        ).length,
        totalAmount: data.reduce((sum, item) => sum + Math.abs(item.amount), 0),
        topItems: {},
        deliverySpeed: {}, // 평균 지급 시간 등
      };

      // 인기 상품 통계
      data.forEach((item) => {
        const itemName =
          item.shop_items?.name || item.item_name || '알 수 없는 상품';
        stats.topItems[itemName] = (stats.topItems[itemName] || 0) + 1;
      });

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      console.error('구매 통계 조회 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 모든 학생 정보 조회 (구매 관리용)
   * 🔒 teacher/principal 권한 필요
   */
  async getAllStudents() {
    try {
      // 🔒 권한 검증
      const roleCheck = await this.verifyUserRole(['teacher', 'principal']);
      if (!roleCheck.success) {
        console.warn('getAllStudents 권한 없음:', roleCheck.error);
        return { success: false, error: roleCheck.error, data: [] };
      }

      // student_details 뷰 사용 (이미 모든 정보가 조인되어 있음)
      const { data, error } = await supabase
        .from('student_details')
        .select('*')
        .eq('role', 'student'); // 학생만 필터링

      if (error) throw error;

      const normalizedData = data.map((student) => ({
        studentId: student.student_id,
        loginId: student.login_id,
        name: student.name,
        avatar: student.avatar || '🦁',
        classId: student.class_id,
        className: student.class_name,
        currentPoints: student.current_points,
        totalPoints: student.total_points,
        savingsPoints: student.savings_points,
        level: student.level,
      }));

      return {
        success: true,
        data: normalizedData,
      };
    } catch (error) {
      console.error('모든 학생 정보 조회 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
  // ==================== 거래 내역 통합 ====================

  /**
   * 전체 거래 내역 조회 (포인트 + 저축 + 구매)
   */
  async getTransactionHistory(loginId) {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting transaction history', {
        loginId,
      });

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

      window.POINTBANK_CONFIG.debugLog('Transaction history loaded', {
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

  // ==================== getRanking 함수 - 휴원생 제외 ====================

  /**
   * 랭킹 조회 - 활성 학생만 포함
   */
  async getRanking(classId = null) {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting ranking', { classId });

      // 1. student_ranking에서 전체 랭킹 조회
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
        window.POINTBANK_CONFIG.debugLog('Ranking error', error);
        throw error;
      }

      // 2. 학생들의 user_id 가져오기 (students 테이블 조회)
      const studentIds = (data || []).map((r) => r.student_id).filter(Boolean);

      let activeStudentIds = new Set();

      if (studentIds.length > 0) {
        // students 테이블에서 user_id 조회
        const { data: students } = await supabase
          .from('students')
          .select('student_id, user_id')
          .in('student_id', studentIds);

        if (students && students.length > 0) {
          const userIds = students.map((s) => s.user_id).filter(Boolean);

          // users 테이블에서 활성 사용자 확인
          const { data: activeUsers } = await supabase
            .from('users')
            .select('user_id')
            .in('user_id', userIds)
            .eq('is_active', true);

          // 활성 user_id를 가진 student_id 찾기
          const activeUserIds = new Set(
            (activeUsers || []).map((u) => u.user_id)
          );
          students.forEach((s) => {
            if (activeUserIds.has(s.user_id)) {
              activeStudentIds.add(s.student_id);
            }
          });
        }
      }

      // 3. 활성 학생만 필터링
      const activeRankings = (data || []).filter((ranking) =>
        activeStudentIds.has(ranking.student_id)
      );

      window.POINTBANK_CONFIG.debugLog('Ranking loaded', {
        total: data?.length || 0,
        active: activeRankings.length,
      });

      // 4. 순위 재계산 및 카멜케이스 변환
      return {
        success: true,
        data: activeRankings.map((student, index) => ({
          rank: index + 1, // 순위 재계산
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
      window.POINTBANK_CONFIG.debugLog('Getting weekly ranking');

      // weekly_ranking 뷰 활용
      const { data, error } = await supabase
        .from('weekly_ranking')
        .select('*')
        .order('rank')
        .limit(50);

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Weekly ranking error', error);
        throw error;
      }

      window.POINTBANK_CONFIG.debugLog('Weekly ranking loaded', {
        count: data?.length || 0,
      });

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

    window.POINTBANK_CONFIG.debugLog('Error handled', {
      code: error.code,
      message,
    });
    return message;
  }

  /**
   * 반 목록 조회
   * students 테이블에서 고유한 class_id 목록을 가져옴
   */
  async getClassList() {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting class list');

      // classes 테이블에서 직접 가져오기 (students 테이블 대신)
      const { data: classes, error } = await supabase
        .from('classes')
        .select('class_id, class_name, class_code, grade, student_count')
        .order('class_code');

      if (error) throw error;

      const classList = {
        elementary: [],
        middle: [],
      };

      classes.forEach((cls) => {
        const classCode = cls.class_code;
        if (!classCode || classCode.length < 2) return;

        // class_code 기준으로 판단
        const isElementary = classCode[0] === 'E';
        const isMiddle = classCode[0] === 'M';
        const dayCode = classCode[1];
        const dayText =
          dayCode === 'M' ? '월수' : dayCode === 'F' ? '화목' : '';
        const classNumber = classCode.substring(2) || '';

        // 반 정보 객체 생성 (기존과 동일한 구조 유지)
        const classInfo = {
          value: cls.class_id, // 실제 ID 사용 (CLS...)
          label: `${classCode}반${dayText ? ` (${dayText})` : ''}`, // 기존과 동일한 형식
          dayType: dayCode,
          classNumber: classNumber,
          // 추가 정보 (필요시 사용)
          className: cls.class_name,
          classCode: classCode,
          studentCount: cls.student_count || 0,
        };

        if (isElementary) {
          classList.elementary.push(classInfo);
        } else if (isMiddle) {
          classList.middle.push(classInfo);
        }
      });

      // 정렬 (요일 -> 반 번호 순)
      const sortClasses = (classes) => {
        return classes.sort((a, b) => {
          if (a.dayType !== b.dayType) {
            return a.dayType === 'M' ? -1 : 1;
          }
          return a.classNumber.localeCompare(b.classNumber);
        });
      };

      classList.elementary = sortClasses(classList.elementary);
      classList.middle = sortClasses(classList.middle);

      window.POINTBANK_CONFIG.debugLog('Class list loaded', classList);

      return {
        success: true,
        data: classList,
      };
    } catch (error) {
      console.error('반 목록 조회 오류:', error);
      return {
        success: false,
        error: error.message,
        data: { elementary: [], middle: [] },
      };
    }
  }

  // ==================== 이자 지급 관련 API ====================

  // 2. processWeeklyInterest 함수 교체
  /**
   * 주간 이자 지급 처리 - students.savings_points 기반으로 전면 수정
   */
  // processWeeklyInterest 함수 수정
  async processWeeklyInterest() {
    try {
      console.log('=== 주간 이자 지급 처리 시작 ===');

      // 중복 지급 체크
      const thisMonday = this.getThisMonday();
      const { data: existing } = await supabase
        .from('interest_payments')
        .select('payment_id')
        .eq('payment_date', thisMonday)
        .limit(1);

      if (existing && existing.length > 0) {
        return {
          success: false,
          error: '이번 주 이자는 이미 지급되었습니다',
          alreadyPaid: true,
        };
      }

      // ⚠️ 수정: current_points 필드 추가!
      const { data: studentsWithSavings, error: fetchError } = await supabase
        .from('students')
        .select(
          `
        student_id,
        name,
        level,
        class_id,
        savings_points,
        current_points, 
        total_points 
      `
        )
        .gt('savings_points', 0);

      if (fetchError) {
        console.error('학생 조회 오류:', fetchError);
        throw fetchError;
      }

      if (!studentsWithSavings || studentsWithSavings.length === 0) {
        return {
          success: false,
          error: '저축 잔액이 있는 학생이 없습니다',
        };
      }

      console.log(`저축 잔액 보유 학생: ${studentsWithSavings.length}명`);

      const results = [];
      const errors = [];

      // 각 학생별로 이자 처리
      for (const student of studentsWithSavings) {
        try {
          // ⚠️ 안전장치 추가
          if (
            student.current_points === null ||
            student.current_points === undefined
          ) {
            console.warn(
              `${student.name} 학생의 current_points가 NULL입니다. 건너뜁니다.`
            );
            errors.push({
              studentId: student.student_id,
              studentName: student.name,
              error: 'current_points가 NULL',
            });
            continue;
          }

          // 이자 계산
          const interestData = this.calculateStudentInterest(student);

          if (interestData.amount > 0) {
            // 이자 지급 실행
            await this.payStudentInterest(student, interestData);

            results.push({
              studentId: student.student_id,
              studentName: student.name,
              amount: interestData.amount,
              balance: student.savings_points,
              level: student.level,
            });
          }
        } catch (error) {
          console.error(`${student.name} 이자 지급 실패:`, error);
          errors.push({
            studentId: student.student_id,
            studentName: student.name,
            error: error.message,
          });
        }
      }

      // 결과 반환
      return {
        success: true,
        data: results,
        errors: errors.length > 0 ? errors : null,
        summary: {
          totalStudents: results.length,
          totalAmount: results.reduce((sum, r) => sum + r.amount, 0),
          averageInterest:
            results.length > 0
              ? Math.floor(
                  results.reduce((sum, r) => sum + r.amount, 0) / results.length
                )
              : 0,
        },
      };
    } catch (error) {
      console.error('이자 지급 처리 실패:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 학생별 이자 계산 (students 테이블 기반)
   */
  calculateStudentInterest(student) {
    const level = student.level || '씨앗';

    // 레벨별 월이율 설정
    const MONTHLY_RATES = {
      씨앗: 2.0,
      새싹: 2.5,
      나무: 3.0,
      큰나무: 3.5,
      별: 4.0,
      다이아몬드: 5.0,
    };

    const monthlyRate = MONTHLY_RATES[level] || 2.0;

    // 다음 주 월요일 기준으로 계산
    const nextMonday = new Date(this.getNextMonday());
    const lastMonday = new Date(this.getLastMonday());

    // ⚠️ 수정: created_at이 없으면 현재 시간 사용
    const accountCreated = new Date(); // 기본값을 현재로 설정

    // 마지막 입금일 계산 - 지금은 계좌 생성일 대신 지난 월요일 사용
    let lastDeposit = lastMonday; // created_at 대신 지난 월요일 사용
    let daysHeld = 7; // 기본값

    // 이번 주 중간에 저축 시작한 경우는 일단 스킵 (데이터가 없으므로)
    // 모든 학생에게 7일 보유로 계산

    // 주간 이자 계산 (월이율 / 4주)
    const fullWeekInterest = Math.floor(
      (student.savings_points * (monthlyRate / 100)) / 4
    );

    // 7일 보유로 고정 계산
    let finalInterest = fullWeekInterest;

    // 최소 이자 보장 (잔액 100P 이상)
    if (student.savings_points >= 100) {
      finalInterest = Math.max(5, fullWeekInterest);
    }

    console.log('Interest calculation:', {
      studentId: student.student_id,
      studentName: student.name,
      level,
      monthlyRate,
      daysHeld,
      fullWeekInterest,
      finalInterest,
      balance: student.savings_points,
    });

    return {
      amount: finalInterest,
      rate: monthlyRate,
      daysHeld: daysHeld,
      balance: student.savings_points,
    };
  }

  /**
  /**
 * 학생에게 이자 지급 실행 (students 테이블 업데이트)
 */
  async payStudentInterest(student, interestData) {
    try {
      // 1. ⚠️ 안전장치: NULL 체크 추가
      const currentBalance = student.current_points || 0;
      const newPointBalance = currentBalance + interestData.amount;

      console.log(
        `${student.name}: ${currentBalance} + ${interestData.amount} = ${newPointBalance}`
      );

      const { error: updateError } = await supabase
        .from('students')
        .update({
          current_points: newPointBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', student.student_id);

      if (updateError) throw updateError;

      // 2. 거래 내역 생성 (transactions 테이블)
      const { error: transError } = await supabase.from('transactions').insert({
        transaction_id: `INT_${Date.now()}_${student.student_id}`,
        student_id: student.student_id,
        type: 'interest',
        amount: interestData.amount,
        item_name: `저축 이자 → 포인트 지급 (월 ${interestData.rate}% / ${interestData.daysHeld}일)`,
        created_at: new Date().toISOString(),
        status: 'completed',
      });

      if (transError) {
        console.error('Transaction error:', transError);
      }

      // 3. 이자 지급 기록 (interest_payments 테이블)
      const { error: paymentError } = await supabase
        .from('interest_payments')
        .insert({
          payment_id: `INT_${Date.now()}_${student.student_id}`, // ⚠️ payment_id 추가
          student_id: student.student_id,
          payment_date: this.getThisMonday(),
          balance_amount: interestData.balance || student.savings_points, // ⚠️ 안전장치
          days_held: interestData.daysHeld,
          interest_rate: interestData.rate,
          interest_amount: interestData.amount,
          payment_status: 'completed',
        });

      if (paymentError) {
        console.error('Payment record error:', paymentError);
      }

      // 4. ⚠️ 기존 코드 유지 - points 테이블에도 기록 (중요!)
      const { error: pointsError } = await supabase.from('points').insert({
        student_id: student.student_id,
        amount: interestData.amount,
        type: 'interest',
        reason: `주간 저축 이자 (${student.level || '씨앗'})`,
        teacher_id: 'SYSTEM',
        created_at: new Date().toISOString(),
      });

      if (pointsError) {
        console.error('Points record error:', pointsError);
      }

      console.log(
        `✅ ${student.name}(${student.student_id}) 이자 ${interestData.amount}P를 포인트로 지급 완료`
      );
    } catch (error) {
      console.error('이자 지급 실행 실패:', error);
      throw error;
    }
  }

  /**
   * 이자 지급 미리보기 (students 테이블 기반)
   */
  async previewInterest() {
    try {
      console.log('=== 이자 미리보기 시작 ===');

      // students 테이블에서 저축 잔액이 있는 학생 조회
      const { data: studentsWithSavings, error: fetchError } = await supabase
        .from('students')
        .select(
          `
        student_id,
        name,
        level,
        class_id,
        savings_points
      `
        )
        .gt('savings_points', 0);

      console.log('저축 보유 학생 조회:', studentsWithSavings);

      if (fetchError) {
        console.error('학생 조회 오류:', fetchError);
        throw fetchError;
      }

      if (!studentsWithSavings || studentsWithSavings.length === 0) {
        return {
          success: true,
          data: [],
          summary: {
            totalAccounts: 0,
            totalAmount: 0,
            averageAmount: 0,
          },
        };
      }

      // 각 학생별 이자 계산
      const preview = [];
      for (const student of studentsWithSavings) {
        const interestData = this.calculateStudentInterest(student);

        if (interestData.amount > 0) {
          preview.push({
            studentId: student.student_id,
            studentName: student.name,
            level: student.level || '씨앗',
            balance: student.savings_points,
            rate: interestData.rate,
            daysHeld: interestData.daysHeld,
            amount: interestData.amount,
          });
        }
      }

      const totalAmount = preview.reduce((sum, item) => sum + item.amount, 0);

      console.log('미리보기 결과:', preview);

      return {
        success: true,
        data: preview,
        summary: {
          totalAccounts: preview.length,
          totalAmount: totalAmount,
          averageAmount:
            preview.length > 0 ? Math.floor(totalAmount / preview.length) : 0,
        },
      };
    } catch (error) {
      console.error('미리보기 실패:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        summary: {
          totalAccounts: 0,
          totalAmount: 0,
          averageAmount: 0,
        },
      };
    }
  }

  /**
   * 이자 지급 이력 조회
   */
  async getInterestPaymentHistory(weeks = 4) {
    try {
      console.log(`=== 최근 ${weeks}주 이자 지급 내역 조회 ===`);

      // 최근 n주의 월요일 날짜 계산
      const mondays = [];
      const today = new Date();

      for (let i = 0; i < weeks; i++) {
        const monday = new Date(today);
        const daysSinceMonday =
          (today.getDay() === 0 ? 6 : today.getDay() - 1) + i * 7;
        monday.setDate(today.getDate() - daysSinceMonday);
        monday.setHours(0, 0, 0, 0);
        mondays.push(monday.toISOString().split('T')[0]);
      }

      console.log('조회할 월요일들:', mondays);

      // 각 주차별 지급 상태 확인
      const history = [];

      for (const mondayDate of mondays) {
        const { data: payments, error } = await supabase
          .from('interest_payments')
          .select('*')
          .eq('payment_date', mondayDate);

        if (error) {
          console.error(`${mondayDate} 조회 오류:`, error);
          continue;
        }

        const totalAmount =
          payments?.reduce((sum, p) => sum + (p.interest_amount || 0), 0) || 0;

        let weekLabel = '이번 주';
        const diffDays = Math.floor(
          (today - new Date(mondayDate)) / (1000 * 60 * 60 * 24)
        );
        if (diffDays >= 7 && diffDays < 14) weekLabel = '지난 주';
        else if (diffDays >= 14 && diffDays < 21) weekLabel = '2주 전';
        else if (diffDays >= 21) weekLabel = '3주 전';

        history.push({
          date: mondayDate,
          weekLabel: weekLabel,
          isPaid: payments && payments.length > 0,
          studentCount: payments?.length || 0,
          totalAmount: totalAmount,
          payments: payments || [],
        });
      }

      console.log('지급 이력:', history);

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      console.error('지급 이력 조회 실패:', error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  // 날짜 헬퍼 함수들
  getThisMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 일요일인 경우 지난 월요일, 아니면 이번 주 월요일
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  getLastMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff - 7); // 지난 주 월요일
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  getNextMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 1 : 8 - day; // 다음 주 월요일
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  /**
   * 이자 지급 내역 조회
   */
  async getInterestHistory(startDate = null, endDate = null) {
    try {
      let query = supabase
        .from('interest_payments')
        .select(
          `
          *,
          students!inner (
            name,
            class_id
          )
        `
        )
        .order('payment_date', { ascending: false });

      if (startDate) {
        query = query.gte('payment_date', startDate);
      }
      if (endDate) {
        query = query.lte('payment_date', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('이자 내역 조회 실패:', error);
      return { success: false, error: error.message };
    }
  }

  // === 날짜 헬퍼 함수들 ===
  getThisMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  getLastMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff - 7);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  getNextMonday() {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  }

  // 기존 getThisMonday() 등 함수들 아래에 추가
  getLastWeekPeriod() {
    const lastMonday = new Date(this.getLastMonday());
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastSunday.getDate() + 6);

    return {
      start: lastMonday,
      end: lastSunday,
      startStr: lastMonday.toISOString().split('T')[0],
      endStr: lastSunday.toISOString().split('T')[0],
      display: `${lastMonday.toLocaleDateString(
        'ko-KR'
      )} ~ ${lastSunday.toLocaleDateString('ko-KR')}`,
    };
  }

  // 과거 미지급분 일괄 처리 함수 추가
  async processAllPendingInterests() {
    try {
      console.log('=== 과거 미지급분 일괄 처리 시작 ===');

      // 미지급 주차 확인
      const { data: unpaidWeeks } = await supabase
        .from('interest_payments')
        .select('payment_date')
        .order('payment_date', { ascending: false });

      const paidDates = new Set(unpaidWeeks?.map((w) => w.payment_date) || []);
      const results = [];

      // 최근 4주 확인
      for (let i = 0; i < 4; i++) {
        const monday = new Date();
        const daysSinceMonday =
          (monday.getDay() === 0 ? 6 : monday.getDay() - 1) + i * 7;
        monday.setDate(monday.getDate() - daysSinceMonday);
        monday.setHours(0, 0, 0, 0);
        const mondayStr = monday.toISOString().split('T')[0];

        if (!paidDates.has(mondayStr)) {
          // 미지급 주차 처리
          console.log(`${mondayStr} 주차 처리 중...`);
          const result = await this.processWeeklyInterestForDate(mondayStr);
          results.push(result);
        }
      }

      return {
        success: true,
        processed: results.length,
        results: results,
      };
    } catch (error) {
      console.error('일괄 처리 실패:', error);
      return { success: false, error: error.message };
    }
  }

  // 특정 날짜 기준 이자 처리 함수 추가
  async processWeeklyInterestForDate(mondayDate) {
    // processWeeklyInterest와 유사하지만 특정 날짜 기준
    // 현재 학생 잔액 기준으로 계산
    // payment_date를 mondayDate로 설정
  }

  // ==================== 포인트 선물 관련 ====================

  /**
   * 포인트 선물 전송
   */
  async sendGift(senderLoginId, receiverStudentId, amount, message = '') {
    try {
      // 1. 보내는 사람 정보 조회
      const { data: sender } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', senderLoginId)
        .single();

      if (!sender) throw new Error('보내는 학생 정보를 찾을 수 없습니다.');

      // 2. 포인트 확인
      if (sender.current_points < amount) {
        return { success: false, error: '포인트가 부족합니다.' };
      }

      // 3. 최소 금액 확인
      if (amount < 10) {
        return { success: false, error: '최소 10P 이상 선물 가능합니다.' };
      }

      // 4. 주간 제한 확인 (300P)
      const weeklyUsed = await this.getWeeklyGiftAmount(sender.student_id);
      if (weeklyUsed + amount > 300) {
        return {
          success: false,
          error: `이번 주 선물 가능 금액을 초과했습니다. (남은 금액: ${
            300 - weeklyUsed
          }P)`,
        };
      }

      // 5. 받는 사람 정보 조회
      const { data: receiver } = await supabase
        .from('students')
        .select('*')
        .eq('student_id', receiverStudentId)
        .single();

      if (!receiver) throw new Error('받는 학생을 찾을 수 없습니다.');

      // 6. 같은 반 확인
      const { data: receiverDetail } = await supabase
        .from('student_details')
        .select('class_id, name')
        .eq('student_id', receiverStudentId)
        .single();

      if (sender.class_id !== receiverDetail.class_id) {
        return {
          success: false,
          error: '같은 반 친구에게만 선물할 수 있습니다.',
        };
      }

      // 7. 트랜잭션 처리
      // 7-1. 보내는 사람 포인트 차감
      await supabase
        .from('students')
        .update({
          current_points: sender.current_points - amount,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', sender.student_id);

      // 7-2. 받는 사람 포인트 증가
      await supabase
        .from('students')
        .update({
          current_points: receiver.current_points + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', receiverStudentId);

      // 7-3. 선물 내역 기록
      await supabase.from('point_gifts').insert({
        sender_id: sender.student_id,
        receiver_id: receiverStudentId,
        amount: amount,
        message: message || null,
      });

      // 7-4. 거래 내역 기록 (보내는 사람)
      await supabase.from('transactions').insert({
        transaction_id: `GIFT_SEND_${Date.now()}`,
        student_id: sender.student_id,
        type: 'gift_sent',
        amount: -amount,
        item_name: `포인트 선물 (to ${receiverDetail.name})`,
        created_at: new Date().toISOString(),
      });

      // 7-5. 거래 내역 기록 (받는 사람)
      await supabase.from('transactions').insert({
        transaction_id: `GIFT_RECV_${Date.now()}`,
        student_id: receiverStudentId,
        type: 'gift_received',
        amount: amount,
        item_name: `포인트 선물 (from ${sender.name})`,
        created_at: new Date().toISOString(),
      });

      return {
        success: true,
        data: {
          senderName: sender.name,
          receiverName: receiverDetail.name,
          amount: amount,
        },
      };
    } catch (error) {
      console.error('선물 전송 실패:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 이번 주 선물한 금액 조회
   */
  async getWeeklyGiftAmount(studentId) {
    try {
      // 월요일 기준 주 시작일 계산
      const now = new Date();
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('point_gifts')
        .select('amount')
        .eq('sender_id', studentId)
        .gte('created_at', monday.toISOString());

      const total = data ? data.reduce((sum, gift) => sum + gift.amount, 0) : 0;
      return total;
    } catch (error) {
      console.error('주간 선물 금액 조회 실패:', error);
      return 0;
    }
  }

  /**
   * 같은 반 친구 목록 조회
   */
  async getClassmates(loginId) {
    try {
      // 현재 학생 정보 조회
      const { data: currentStudent } = await supabase
        .from('student_details')
        .select('student_id, class_id')
        .eq('login_id', loginId)
        .single();

      if (!currentStudent) throw new Error('학생 정보를 찾을 수 없습니다.');

      // 같은 반 학생들 조회
      const { data: classmates } = await supabase
        .from('student_details')
        .select('student_id, name, avatar, login_id')
        .eq('class_id', currentStudent.class_id)
        .neq('student_id', currentStudent.student_id)
        .order('name');

      return {
        success: true,
        data: classmates || [],
      };
    } catch (error) {
      console.error('반 친구 조회 실패:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 선물 내역 조회
   */
  async getGiftHistory(loginId) {
    try {
      const { data: student } = await supabase
        .from('student_details')
        .select('student_id')
        .eq('login_id', loginId)
        .single();

      if (!student) throw new Error('학생 정보를 찾을 수 없습니다.');

      // 보낸 선물과 받은 선물 모두 조회
      const { data: gifts } = await supabase
        .from('point_gifts')
        .select(
          `
          *,
          sender:students!sender_id(name, avatar),
          receiver:students!receiver_id(name, avatar)
        `
        )
        .or(
          `sender_id.eq.${student.student_id},receiver_id.eq.${student.student_id}`
        )
        .order('created_at', { ascending: false })
        .limit(50);

      return {
        success: true,
        data: gifts || [],
      };
    } catch (error) {
      console.error('선물 내역 조회 실패:', error);
      return { success: false, error: error.message };
    }
  }
}

// API 인스턴스 생성
const api = new PointBankAPI();

// ✅ window.api는 항상 설정 (프로덕션/개발 모두)
window.api = api;

// 개발 환경에서만 추가 디버깅 도구 노출
if (window.POINTBANK_CONFIG.env === 'development') {
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
  window.POINTBANK_CONFIG.debugLog('Unhandled API error', event.reason);

  // 프로덕션에서는 사용자에게 친화적인 메시지 표시
  if (window.POINTBANK_CONFIG.env === 'production') {
    console.error('API 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
});

// 네트워크 상태 체크
window.addEventListener('online', () => {
  window.POINTBANK_CONFIG.debugLog('Network online');
  // 필요시 재연결 로직
});

window.addEventListener('offline', () => {
  window.POINTBANK_CONFIG.debugLog('Network offline');
  console.warn('네트워크 연결이 끊어졌습니다.');
});
