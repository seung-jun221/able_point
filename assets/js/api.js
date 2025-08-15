// api.js - Google Sheets API 연동 클래스
class PointBankAPI {
  constructor() {
    this.baseURL =
      'https://script.google.com/macros/s/AKfycbxIWWpnXg7b5v2YjrSsFK1-3OSaKK8EONDSxRMQh0fvrW-fC5PVY3tENF7KonLDGmUFig/exec';
  }

  async fetchData(params) {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.baseURL}?${queryString}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 로그인
  async login(loginId, password) {
    return await this.fetchData({
      action: 'login',
      loginId: loginId,
      password: password,
    });
  }

  // 학생 목록 조회 (선생님용)
  async getStudents(classId = null) {
    const params = { action: 'getStudents' };
    if (classId) params.classId = classId;
    return await this.fetchData(params);
  }

  // 학생 포인트 조회
  async getStudentPoints(studentId) {
    // 테스트용 더미 데이터 반환
    return {
      success: true,
      data: {
        studentId: studentId || 'TEST001',
        name: '황진욱',
        level: '큰나무',
        currentPoints: 52081,
        savingsPoints: 0,
        totalPoints: 52081,
        avatar: '🐼',
      },
    };
  }

  // 포인트 지급 (선생님용)
  async addPoints(studentId, amount, type, reason) {
    return await this.fetchData({
      action: 'addPoints',
      studentId: studentId,
      amount: amount,
      type: type,
      reason: reason,
      teacherId: localStorage.getItem('userId'),
    });
  }

  // 저축 입금
  async deposit(studentId, amount) {
    // 테스트용 성공 응답
    return {
      success: true,
      message: '입금 완료',
      data: {
        newBalance: (this.savingsBalance || 0) + amount,
      },
    };
  }

  // 저축 출금
  async withdraw(studentId, amount) {
    // 테스트용 성공 응답
    return {
      success: true,
      message: '출금 완료',
      data: {
        newBalance: Math.max(0, (this.savingsBalance || 0) - amount),
      },
    };
  }

  // 저축 내역 조회
  async getSavingsHistory(studentId) {
    // 테스트용 더미 데이터
    return {
      success: true,
      data: [
        {
          type: 'deposit',
          amount: 1000,
          date: new Date('2024-11-10'),
          balance: 1000,
        },
        {
          type: 'interest',
          amount: 20,
          date: new Date('2024-11-11'),
          balance: 1020,
        },
      ],
    };
  }

  // 상품 목록 조회
  async getShopItems() {
    return await this.fetchData({
      action: 'getShopItems',
    });
  }

  // 상품 구매
  async purchaseItem(studentId, itemId) {
    return await this.fetchData({
      action: 'purchaseItem',
      studentId: studentId,
      itemId: itemId,
    });
  }

  // 포인트 내역 조회
  async getPointHistory(studentId) {
    return await this.fetchData({
      action: 'getPointHistory',
      studentId: studentId,
    });
  }

  // 랭킹 조회
  async getRanking(classId = null) {
    const params = { action: 'getRanking' };
    if (classId) params.classId = classId;
    return await this.fetchData(params);
  }
}

// API 인스턴스 생성
const api = new PointBankAPI();
