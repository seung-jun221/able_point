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
      window.POINTBANK_CONFIG.debugLog('Login attempt', { loginId });

      // users 테이블에서 사용자 조회
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginId)
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

  /**
   * 학생 목록 조회 (선생님용)
   */
  async getStudents(classId = null) {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting students', { classId });

      // student_details 뷰 활용
      let query = supabase.from('student_details').select('*').order('name');

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (error) {
        window.POINTBANK_CONFIG.debugLog('Get students error', error);
        throw error;
      }

      window.POINTBANK_CONFIG.debugLog('Students loaded', {
        count: data?.length || 0,
      });

      // ✅ 언더스코어를 카멜케이스로 변환
      return {
        success: true,
        data: data
          ? data.map((student) => ({
              studentId: student.student_id,
              userId: student.user_id,
              name: student.name,
              classId: student.class_id,
              level: student.level || '씨앗',
              totalPoints: student.total_points || 0,
              currentPoints: student.current_points || 0,
              savingsPoints: student.savings_points || 0,
              avatar: student.avatar || '🦁',
              parentUserId: student.parent_user_id,
              updatedAt: student.updated_at,
              loginId: student.login_id,
              className: student.class_name,
              grade: student.grade,
            }))
          : [],
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

  // ==================== 포인트 관련 ====================

  /**
   * 포인트 지급
   */
  async addPoints(loginId, amount, type, reason) {
    try {
      window.POINTBANK_CONFIG.debugLog('Adding points', {
        loginId,
        amount,
        type,
        reason,
      });

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
  async checkWeeklyPurchaseLimit(studentId) {
    try {
      console.log(`[구매제한체크] 학생ID: ${studentId} 확인 시작`);

      // 이번 주 월요일 9시 계산
      const now = new Date();
      const currentDay = now.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;

      const mondayMorning = new Date(now);
      mondayMorning.setDate(now.getDate() - daysFromMonday);
      mondayMorning.setHours(9, 0, 0, 0);

      // 현재 시간이 월요일 9시 이전이면 이전 주로 설정
      if (now < mondayMorning) {
        mondayMorning.setDate(mondayMorning.getDate() - 7);
      }

      console.log(`[구매제한체크] 기준시간: ${mondayMorning.toISOString()}`);

      // 이번 주 구매 횟수 조회
      const { data, error } = await supabase
        .from('transactions')
        .select('id, created_at, item_name')
        .eq('student_id', studentId)
        .eq('type', 'purchase')
        .gte('created_at', mondayMorning.toISOString());

      // 디버깅용 상세 로그
      console.log(`[구매제한체크] 쿼리 결과:`, {
        error: error,
        dataCount: data ? data.length : 'null',
        data: data,
      });

      // 에러가 없고 데이터를 정상적으로 받은 경우
      if (!error) {
        const purchaseCount = data ? data.length : 0;
        const maxPurchases = 1;

        console.log(
          `[구매제한체크] 이번 주 구매 횟수: ${purchaseCount}/${maxPurchases}`
        );

        // 이미 구매한 내역이 있으면 확실하게 차단
        if (purchaseCount >= maxPurchases) {
          console.log(`[구매제한체크] ❌ 구매 제한 도달 - 구매 불가`);
          if (data && data.length > 0) {
            console.log(
              `[구매제한체크] 최근 구매: ${data[0].item_name} at ${data[0].created_at}`
            );
          }
          return {
            canPurchase: false,
            purchaseCount: purchaseCount,
            remainingPurchases: 0,
            resetTime: mondayMorning.toISOString(),
          };
        }

        // 구매 내역이 없는 경우에만 구매 허용
        console.log(
          `[구매제한체크] ✅ 구매 가능 (${maxPurchases - purchaseCount}회 남음)`
        );
        return {
          canPurchase: true,
          purchaseCount: purchaseCount,
          remainingPurchases: maxPurchases - purchaseCount,
          resetTime: mondayMorning.toISOString(),
        };
      }

      // 에러가 발생한 경우
      console.error(`[구매제한체크] ⚠️ 데이터베이스 에러:`, error);

      // 특정 에러 코드 체크 (테이블 없음, 권한 없음 등)
      if (
        error.code === 'PGRST116' ||
        error.code === '42P01' ||
        error.code === '42501'
      ) {
        console.log(`[구매제한체크] 첫 사용자 가능성 - 구매 1회 허용`);
        return {
          canPurchase: true,
          purchaseCount: 0,
          remainingPurchases: 1,
          resetTime: mondayMorning.toISOString(),
        };
      }

      // 기타 에러는 안전을 위해 구매 차단
      console.log(`[구매제한체크] 알 수 없는 에러 - 안전을 위해 구매 차단`);
      return {
        canPurchase: false,
        purchaseCount: 0,
        remainingPurchases: 0,
        resetTime: mondayMorning.toISOString(),
      };
    } catch (error) {
      console.error(`[구매제한체크] 💥 시스템 에러:`, error);

      // 시스템 에러는 안전을 위해 구매 차단
      return {
        canPurchase: false,
        purchaseCount: 0,
        remainingPurchases: 0,
        resetTime: new Date().toISOString(),
      };
    }
  }

  // ==================== 구매 관리용 함수들 ====================

  /**
   * 모든 구매 내역 조회 (구매 관리용)
   */
  async getAllPurchases() {
    try {
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
   */
  async markAsDelivered(transactionId, teacherId, teacherName, notes = '') {
    try {
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
   */
  async getAllStudents() {
    try {
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

  /**
   * 랭킹 조회
   */
  async getRanking(classId = null) {
    try {
      window.POINTBANK_CONFIG.debugLog('Getting ranking', { classId });

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
        window.POINTBANK_CONFIG.debugLog('Ranking error', error);
        throw error;
      }

      window.POINTBANK_CONFIG.debugLog('Ranking loaded', {
        count: data?.length || 0,
      });

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

      // students 테이블에서 고유한 class_id 가져오기
      const { data: students, error } = await supabase
        .from('students')
        .select('class_id')
        .not('class_id', 'is', null)
        .order('class_id');

      if (error) throw error;

      // 중복 제거 및 반 목록 생성
      const uniqueClasses = [...new Set(students.map((s) => s.class_id))];

      // 반 정보 구조화
      const classList = {
        elementary: [],
        middle: [],
      };

      uniqueClasses.forEach((classId) => {
        if (!classId || classId.length < 2) return;

        // 첫 글자로 초등/중등 구분
        const isElementary = classId[0] === 'E';
        const isMiddle = classId[0] === 'M';

        // 두 번째 글자로 요일 구분
        const dayCode = classId[1];
        const dayText =
          dayCode === 'M' ? '월수' : dayCode === 'F' ? '화목' : '';

        // 반 번호
        const classNumber = classId.substring(2) || '';

        // 반 정보 객체 생성
        const classInfo = {
          value: classId,
          label: `${classId}반${dayText ? ` (${dayText})` : ''}`,
          dayType: dayCode, // M 또는 F
          classNumber: classNumber,
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
          // 월수(M)를 화목(F)보다 먼저
          if (a.dayType !== b.dayType) {
            return a.dayType === 'M' ? -1 : 1;
          }
          // 같은 요일이면 반 번호순
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
