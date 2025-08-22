// api.js - Supabase 연동 버전

// Supabase 설정
const SUPABASE_URL = 'https://wdravtbwtocieprqrjfc.supabase.co'; // 여기에 실제 URL 입력
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcmF2dGJ3dG9jaWVwcnFyamZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NTA3NDQsImV4cCI6MjA3MTQyNjc0NH0.s5xtRzKsx3H21hIZUtPy366s-TYrEFLdkOeTwW6Qs-o'; // 여기에 실제 키 입력

// Supabase 클라이언트 초기화
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

class PointBankAPI {
  constructor() {
    this.currentUser = null;
  }

  // 현재 세션 체크
  async checkSession() {
    const userId = localStorage.getItem('userId');
    if (userId) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        this.currentUser = data;
        return true;
      }
    }
    return false;
  }

  // 로그인
  async login(loginId, password) {
    try {
      // 사용자 조회
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('login_id', loginId)
        .eq('password', password) // 실제로는 해시된 비밀번호 비교 필요
        .single();

      if (error || !user) {
        return {
          success: false,
          error: '아이디 또는 비밀번호가 올바르지 않습니다.',
        };
      }

      // 학생인 경우 포인트 정보도 조회
      if (user.role === 'student') {
        const { data: points } = await supabase
          .from('student_points')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (points) {
          user.currentPoints = points.current_points;
          user.totalPoints = points.total_points;
          user.savingsPoints = points.savings_points;
          user.level = points.level;
        }
      }

      this.currentUser = user;

      return {
        success: true,
        data: {
          userId: user.id,
          loginId: user.login_id,
          name: user.name,
          role: user.role,
          classId: user.class_id,
          avatar: user.avatar,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  // 학생 목록 조회
  async getStudents(classId = null) {
    try {
      let query = supabase.from('student_details').select('*').order('name');

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error('Get students error:', error);
      return { success: false, error: error.message };
    }
  }

  // 학생 포인트 조회
  async getStudentPoints(studentId) {
    try {
      const { data, error } = await supabase
        .from('student_details')
        .select('*')
        .eq('login_id', studentId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          studentId: data.id,
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

  // 포인트 지급
  async addPoints(studentId, amount, type, reason) {
    try {
      // 트랜잭션 시작
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('login_id', studentId)
        .single();

      if (!student) {
        throw new Error('학생을 찾을 수 없습니다.');
      }

      // 포인트 거래 기록
      const { error: transError } = await supabase
        .from('point_transactions')
        .insert({
          student_id: student.id,
          teacher_id: this.currentUser?.id,
          amount: parseInt(amount),
          type: type,
          reason: reason,
        });

      if (transError) throw transError;

      // 학생 포인트 업데이트
      const { data: currentPoints } = await supabase
        .from('student_points')
        .select('*')
        .eq('user_id', student.id)
        .single();

      const newCurrentPoints =
        (currentPoints?.current_points || 0) + parseInt(amount);
      const newTotalPoints =
        (currentPoints?.total_points || 0) + parseInt(amount);

      const { error: updateError } = await supabase
        .from('student_points')
        .upsert({
          user_id: student.id,
          current_points: newCurrentPoints,
          total_points: newTotalPoints,
          savings_points: currentPoints?.savings_points || 0,
          level: this.calculateLevel(newTotalPoints),
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error('Add points error:', error);
      return { success: false, error: error.message };
    }
  }

  // 저축 입금
  async deposit(studentId, amount) {
    try {
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('login_id', studentId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // 현재 포인트 조회
      const { data: points } = await supabase
        .from('student_points')
        .select('*')
        .eq('user_id', student.id)
        .single();

      if (!points || points.current_points < amount) {
        throw new Error('포인트가 부족합니다.');
      }

      // 저축 거래 기록
      const newSavings = points.savings_points + parseInt(amount);

      const { error: transError } = await supabase
        .from('savings_transactions')
        .insert({
          student_id: student.id,
          amount: parseInt(amount),
          type: 'deposit',
          balance_after: newSavings,
        });

      if (transError) throw transError;

      // 포인트 업데이트
      const { error: updateError } = await supabase
        .from('student_points')
        .update({
          current_points: points.current_points - parseInt(amount),
          savings_points: newSavings,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', student.id);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error('Deposit error:', error);
      return { success: false, error: error.message };
    }
  }

  // 저축 출금
  async withdraw(studentId, amount) {
    try {
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('login_id', studentId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // 현재 포인트 조회
      const { data: points } = await supabase
        .from('student_points')
        .select('*')
        .eq('user_id', student.id)
        .single();

      if (!points || points.savings_points < amount) {
        throw new Error('저축 포인트가 부족합니다.');
      }

      // 저축 거래 기록
      const newSavings = points.savings_points - parseInt(amount);

      const { error: transError } = await supabase
        .from('savings_transactions')
        .insert({
          student_id: student.id,
          amount: parseInt(amount),
          type: 'withdraw',
          balance_after: newSavings,
        });

      if (transError) throw transError;

      // 포인트 업데이트
      const { error: updateError } = await supabase
        .from('student_points')
        .update({
          current_points: points.current_points + parseInt(amount),
          savings_points: newSavings,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', student.id);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error('Withdraw error:', error);
      return { success: false, error: error.message };
    }
  }

  // 저축 내역 조회
  async getSavingsHistory(studentId) {
    try {
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('login_id', studentId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      const { data, error } = await supabase
        .from('savings_transactions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return {
        success: true,
        data: data.map((item) => ({
          type: item.type,
          amount: item.amount,
          date: item.created_at,
          balance: item.balance_after,
        })),
      };
    } catch (error) {
      console.error('Get savings history error:', error);
      return { success: false, error: error.message };
    }
  }

  // 상품 목록 조회
  async getShopItems() {
    try {
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('is_active', true)
        .order('category, price');

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      console.error('Get shop items error:', error);
      return { success: false, error: error.message };
    }
  }

  // 상품 구매
  async purchaseItem(studentId, itemId) {
    try {
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('login_id', studentId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // 상품 정보 조회
      const { data: item } = await supabase
        .from('shop_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (!item || item.stock <= 0) {
        throw new Error('상품이 품절되었습니다.');
      }

      // 학생 포인트 조회
      const { data: points } = await supabase
        .from('student_points')
        .select('*')
        .eq('user_id', student.id)
        .single();

      if (!points || points.current_points < item.price) {
        throw new Error('포인트가 부족합니다.');
      }

      // 구매 기록
      const { error: purchaseError } = await supabase
        .from('purchase_history')
        .insert({
          student_id: student.id,
          item_id: item.id,
          price: item.price,
        });

      if (purchaseError) throw purchaseError;

      // 포인트 차감
      const { error: pointError } = await supabase
        .from('student_points')
        .update({
          current_points: points.current_points - item.price,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', student.id);

      if (pointError) throw pointError;

      // 재고 감소
      const { error: stockError } = await supabase
        .from('shop_items')
        .update({
          stock: item.stock - 1,
        })
        .eq('id', item.id);

      if (stockError) throw stockError;

      return { success: true };
    } catch (error) {
      console.error('Purchase item error:', error);
      return { success: false, error: error.message };
    }
  }

  // 포인트 내역 조회
  async getPointHistory(studentId) {
    try {
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('login_id', studentId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      const { data, error } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

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

  // 거래 내역 조회 (저축 + 구매)
  async getTransactionHistory(studentId) {
    try {
      const { data: student } = await supabase
        .from('users')
        .select('id')
        .eq('login_id', studentId)
        .single();

      if (!student) throw new Error('학생을 찾을 수 없습니다.');

      // 저축 내역
      const { data: savings } = await supabase
        .from('savings_transactions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(50);

      // 구매 내역
      const { data: purchases } = await supabase
        .from('purchase_history')
        .select('*, shop_items(name)')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const allTransactions = [
        ...(savings || []).map((s) => ({
          type: s.type,
          amount: s.type === 'withdraw' ? s.amount : -s.amount,
          itemName:
            s.type === 'deposit'
              ? '저축 입금'
              : s.type === 'withdraw'
              ? '저축 출금'
              : '이자 지급',
          createdAt: s.created_at,
        })),
        ...(purchases || []).map((p) => ({
          type: 'purchase',
          amount: -p.price,
          itemName: p.shop_items?.name || '상품 구매',
          createdAt: p.created_at,
        })),
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        success: true,
        data: allTransactions,
      };
    } catch (error) {
      console.error('Get transaction history error:', error);
      return { success: false, error: error.message };
    }
  }

  // 랭킹 조회
  async getRanking(classId = null) {
    try {
      let query = supabase
        .from('student_details')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(50);

      if (classId) {
        query = query.eq('class_id', classId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data.map((student, index) => ({
          rank: index + 1,
          studentId: student.login_id,
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

  // 레벨 계산 헬퍼 함수
  calculateLevel(totalPoints) {
    if (totalPoints >= 50000) return '다이아몬드';
    if (totalPoints >= 30000) return '별';
    if (totalPoints >= 5000) return '큰나무';
    if (totalPoints >= 3000) return '나무';
    if (totalPoints >= 1000) return '새싹';
    return '씨앗';
  }
}

// API 인스턴스 생성
const api = new PointBankAPI();

// 전역 에러 핸들러
window.addEventListener('unhandledrejection', (event) => {
  console.error('API 오류:', event.reason);
});
