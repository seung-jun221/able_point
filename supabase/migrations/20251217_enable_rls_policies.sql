-- ============================================
-- RLS (Row Level Security) 활성화 및 정책 설정
-- 실행일: 2024-12-17
-- 대상: UNRESTRICTED 상태인 테이블들
-- ============================================

-- ============================================
-- 1. interest_payments 테이블
-- ============================================
ALTER TABLE interest_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_interest_payments" ON interest_payments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_interest_payments" ON interest_payments
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_interest_payments" ON interest_payments
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_interest_payments" ON interest_payments
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 2. point_gifts 테이블
-- ============================================
ALTER TABLE point_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_point_gifts" ON point_gifts
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_point_gifts" ON point_gifts
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_point_gifts" ON point_gifts
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_point_gifts" ON point_gifts
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 3. points 테이블
-- ============================================
ALTER TABLE points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_points" ON points
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_points" ON points
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_points" ON points
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_points" ON points
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 4. points_backup 테이블
-- ============================================
ALTER TABLE points_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_points_backup" ON points_backup
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_points_backup" ON points_backup
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_points_backup" ON points_backup
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_points_backup" ON points_backup
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 5. purchase_management 테이블
-- ============================================
ALTER TABLE purchase_management ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_purchase_management" ON purchase_management
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_purchase_management" ON purchase_management
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_purchase_management" ON purchase_management
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_purchase_management" ON purchase_management
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 6. savings_transactions 테이블
-- ============================================
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_savings_transactions" ON savings_transactions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_savings_transactions" ON savings_transactions
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_savings_transactions" ON savings_transactions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_savings_transactions" ON savings_transactions
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 7. simple_purchases 테이블
-- ============================================
ALTER TABLE simple_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_simple_purchases" ON simple_purchases
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_insert_simple_purchases" ON simple_purchases
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_simple_purchases" ON simple_purchases
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_simple_purchases" ON simple_purchases
    FOR DELETE TO authenticated USING (true);

-- ============================================
-- 8. student_details (VIEW인 경우 스킵)
-- 만약 테이블이라면 아래 실행
-- ============================================
-- student_details가 VIEW인지 TABLE인지 확인 필요
-- VIEW라면 RLS 적용 불가 (기반 테이블에 적용해야 함)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'student_details'
        AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE student_details ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_details' AND policyname = 'authenticated_select_student_details') THEN
            CREATE POLICY "authenticated_select_student_details" ON student_details
                FOR SELECT TO authenticated USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_details' AND policyname = 'authenticated_insert_student_details') THEN
            CREATE POLICY "authenticated_insert_student_details" ON student_details
                FOR INSERT TO authenticated WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_details' AND policyname = 'authenticated_update_student_details') THEN
            CREATE POLICY "authenticated_update_student_details" ON student_details
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_details' AND policyname = 'authenticated_delete_student_details') THEN
            CREATE POLICY "authenticated_delete_student_details" ON student_details
                FOR DELETE TO authenticated USING (true);
        END IF;
    END IF;
END $$;

-- ============================================
-- 9. student_ranking (VIEW인 경우 스킵)
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'student_ranking'
        AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE student_ranking ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_ranking' AND policyname = 'authenticated_select_student_ranking') THEN
            CREATE POLICY "authenticated_select_student_ranking" ON student_ranking
                FOR SELECT TO authenticated USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_ranking' AND policyname = 'authenticated_insert_student_ranking') THEN
            CREATE POLICY "authenticated_insert_student_ranking" ON student_ranking
                FOR INSERT TO authenticated WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_ranking' AND policyname = 'authenticated_update_student_ranking') THEN
            CREATE POLICY "authenticated_update_student_ranking" ON student_ranking
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_ranking' AND policyname = 'authenticated_delete_student_ranking') THEN
            CREATE POLICY "authenticated_delete_student_ranking" ON student_ranking
                FOR DELETE TO authenticated USING (true);
        END IF;
    END IF;
END $$;

-- ============================================
-- 10. weekly_ranking (VIEW인 경우 스킵)
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'weekly_ranking'
        AND table_type = 'BASE TABLE'
    ) THEN
        ALTER TABLE weekly_ranking ENABLE ROW LEVEL SECURITY;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_ranking' AND policyname = 'authenticated_select_weekly_ranking') THEN
            CREATE POLICY "authenticated_select_weekly_ranking" ON weekly_ranking
                FOR SELECT TO authenticated USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_ranking' AND policyname = 'authenticated_insert_weekly_ranking') THEN
            CREATE POLICY "authenticated_insert_weekly_ranking" ON weekly_ranking
                FOR INSERT TO authenticated WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_ranking' AND policyname = 'authenticated_update_weekly_ranking') THEN
            CREATE POLICY "authenticated_update_weekly_ranking" ON weekly_ranking
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_ranking' AND policyname = 'authenticated_delete_weekly_ranking') THEN
            CREATE POLICY "authenticated_delete_weekly_ranking" ON weekly_ranking
                FOR DELETE TO authenticated USING (true);
        END IF;
    END IF;
END $$;

-- ============================================
-- 11. students_backup 테이블 (여러 개 있을 수 있음)
-- ============================================
ALTER TABLE IF EXISTS students_backup ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students_backup') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students_backup' AND policyname = 'authenticated_select_students_backup') THEN
            CREATE POLICY "authenticated_select_students_backup" ON students_backup
                FOR SELECT TO authenticated USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students_backup' AND policyname = 'authenticated_insert_students_backup') THEN
            CREATE POLICY "authenticated_insert_students_backup" ON students_backup
                FOR INSERT TO authenticated WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students_backup' AND policyname = 'authenticated_update_students_backup') THEN
            CREATE POLICY "authenticated_update_students_backup" ON students_backup
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'students_backup' AND policyname = 'authenticated_delete_students_backup') THEN
            CREATE POLICY "authenticated_delete_students_backup" ON students_backup
                FOR DELETE TO authenticated USING (true);
        END IF;
    END IF;
END $$;

-- ============================================
-- 12. transactions_backup 테이블
-- ============================================
ALTER TABLE IF EXISTS transactions_backup ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions_backup') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions_backup' AND policyname = 'authenticated_select_transactions_backup') THEN
            CREATE POLICY "authenticated_select_transactions_backup" ON transactions_backup
                FOR SELECT TO authenticated USING (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions_backup' AND policyname = 'authenticated_insert_transactions_backup') THEN
            CREATE POLICY "authenticated_insert_transactions_backup" ON transactions_backup
                FOR INSERT TO authenticated WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions_backup' AND policyname = 'authenticated_update_transactions_backup') THEN
            CREATE POLICY "authenticated_update_transactions_backup" ON transactions_backup
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions_backup' AND policyname = 'authenticated_delete_transactions_backup') THEN
            CREATE POLICY "authenticated_delete_transactions_backup" ON transactions_backup
                FOR DELETE TO authenticated USING (true);
        END IF;
    END IF;
END $$;

-- ============================================
-- 추가: anon 역할에도 읽기 권한 부여 (필요한 경우)
-- 현재 앱이 anon key를 사용한다면 아래 주석 해제
-- ============================================

-- interest_payments
CREATE POLICY "anon_select_interest_payments" ON interest_payments
    FOR SELECT TO anon USING (true);

-- point_gifts
CREATE POLICY "anon_select_point_gifts" ON point_gifts
    FOR SELECT TO anon USING (true);

-- points
CREATE POLICY "anon_select_points" ON points
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_points" ON points
    FOR INSERT TO anon WITH CHECK (true);

-- savings_transactions
CREATE POLICY "anon_select_savings_transactions" ON savings_transactions
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_savings_transactions" ON savings_transactions
    FOR INSERT TO anon WITH CHECK (true);

-- simple_purchases
CREATE POLICY "anon_select_simple_purchases" ON simple_purchases
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_simple_purchases" ON simple_purchases
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_simple_purchases" ON simple_purchases
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- purchase_management
CREATE POLICY "anon_select_purchase_management" ON purchase_management
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_purchase_management" ON purchase_management
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_purchase_management" ON purchase_management
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ============================================
-- 완료 메시지
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'RLS 정책이 성공적으로 적용되었습니다.';
END $$;
