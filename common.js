// ==========================================
// 파일명: common.js
// 공통 데이터베이스 설정 및 핵심 유틸리티 함수
// ==========================================

// 1. Supabase 초기화 공통 설정
const SUPABASE_URL = 'https://hqiijssfdullpfpfidbz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaWlqc3NmZHVsbHBmcGZpZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTUyOTgsImV4cCI6MjA5MjY3MTI5OH0.FxDFaCsqE2EwHUCbzt15aPkpFcIjXr-chjd01d87-vs';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. 공통 타임 인정 계산 함수
// (statistics.html, split_admin.html, settings.html 등에서 공통 사용)
function getRecognizedTimes(log, appliedTimesStr, currentScheduleData) {
    // currentScheduleData가 안 들어오면 전역 변수 currentSchedule을 사용하도록 처리
    const schedule = currentScheduleData || (typeof currentSchedule !== 'undefined' ? currentSchedule : {});

    if (!log || log.status === "미입실" || log.status === "귀가(누락)") return 0;
    if (!appliedTimesStr) return 0;

    let appliedArray = appliedTimesStr.split(',').map(v => v.trim()).filter(v => v);
    let recognizedCount = 0;

    // 1) 교사 수동 인정 체크 (가장 우선)
    if (log.history) {
        let manualSet = new Set();
        log.history.forEach(h => {
            appliedArray.forEach(t => {
                if (h.includes(`${t}T귀가(교사)`) || h.includes(`${t}T외출(교사)`)) manualSet.add(t);
            });
        });
        if (manualSet.size > 0) return manualSet.size;
    }

    // 2) 시간 기반 체크 (키오스크 귀가)
    if (log.status === "귀가" && log.history) {
        let lastTimeStr = "";
        for (let i = log.history.length - 1; i >= 0; i--) {
            if (log.history[i].includes("귀가") && !log.history[i].includes("누락")) {
                const match = log.history[i].match(/(\d{2}:\d{2})/);
                if (match) { lastTimeStr = match[1]; break; }
            }
        }

        if (lastTimeStr) {
            const [h, m] = lastTimeStr.split(':').map(Number);
            const finishMin = h * 60 + m;
            const timeToMin = (t) => { const [sh, sm] = t.split(':').map(Number); return sh * 60 + sm; };

            appliedArray.forEach(t => {
                const startStr = schedule[`t${t}`];
                const reqMin = schedule[`t${t}_req`] || 0;
                if (startStr && finishMin >= (timeToMin(startStr) + reqMin)) recognizedCount++;
            });
        }
    } else if (["입실", "복귀", "외출"].includes(log.status)) {
        // 진행 중인 상태
        recognizedCount += appliedArray.length;
    }

    return recognizedCount;
}