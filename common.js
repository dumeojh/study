// ==========================================
// 파일명: common.js
// 공통 데이터베이스 설정 및 핵심 유틸리티 함수
// ==========================================

// 1. Supabase 초기화 공통 설정
const SUPABASE_URL = 'https://hqiijssfdullpfpfidbz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaWlqc3NmZHVsbHBmcGZpZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTUyOTgsImV4cCI6MjA5MjY3MTI5OH0.FxDFaCsqE2EwHUCbzt15aPkpFcIjXr-chjd01d87-vs';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 👇👇 [여기에 추가] 공통 관리자 인증 함수 👇👇
async function requireAdminAuth() {
    try {
        // 1. 현재 브라우저에 로그인된 세션(사용자)이 있는지 확인
        const { data: { session } } = await supabaseClient.auth.getSession();

        // 2. 이미 로그인되어 있고, 그 계정이 선생님 계정이라면 프리패스!
        if (session && session.user.email === 'teacher@anseong.kr') {
            document.getElementById('main-content').style.display = 'block';
            return true; // 인증 성공
        }

        // 3. 로그인이 안 되어 있다면 팝업으로 비밀번호를 물어봄
        const pwd = prompt("관리자(teacher@anseong.kr) 비밀번호를 입력하세요:");

        if (!pwd) {
            // 취소를 누른 경우 화면 차단
            document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px; color:#dc3545;'>접근이 차단되었습니다. (새로고침하여 다시 로그인하세요)</h2>";
            return false;
        }

        // 4. 입력받은 비밀번호로 수파베이스에 정식 로그인 요청
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: 'teacher@anseong.kr',
            password: pwd
        });

        if (error) {
            alert("비밀번호가 틀렸습니다. 다시 시도해주세요.");

            location.reload(); // 새로고침하여 다시 잠금
            return false;
        } else {
            // 로그인 성공 시 숨겨둔 화면을 보여줌
            document.getElementById('main-content').style.display = 'block';
            return true;
        }
    } catch (err) {
        alert("인증 처리 중 오류가 발생했습니다.");
        console.error(err);
        return false;
    }
}
// 👆👆 [추가 끝] 👆👆


// 2. 공통 타임 인정 계산 함수 (완벽 통합 버전)
function getRecognizedTimes(log, currentScheduleData) {
    const schedule = currentScheduleData || (typeof currentSchedule !== 'undefined' ? currentSchedule : {});
    let recognizedSet = new Set(); // 인정받은 타임(1, 2, 3)을 담는 바구니

    if (!log || log.status === "미입실" || log.status === "귀가(누락)") return recognizedSet;

    const history = log.history || [];

    // 1) 관리자 수동 인정(교사) 체크 (가장 우선)
    history.forEach(h => {
        [1, 2, 3].forEach(t => {
            if (h.includes(`${t}T귀가(교사)`) || h.includes(`${t}T외출(교사)`) || h.includes(`${t}T입실(교사)`)) {
                recognizedSet.add(t);
            }
        });
    });
    if (recognizedSet.size > 0) return recognizedSet;

    const timeToMin = (tmStr) => { const [h, m] = tmStr.split(':').map(Number); return h * 60 + m; };

    // 2) 정상 귀가 시 시간 계산 (신청 여부 무관하게 무조건 1,2,3타임 검사)
    if (log.status === "귀가") {
        let lastTimeStr = "";
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].includes("귀가") && !history[i].includes("누락")) {
                const match = history[i].match(/(\d{2}:\d{2})/);
                if (match) { lastTimeStr = match[1]; break; }
            }
        }

        if (lastTimeStr) {
            const finishMin = timeToMin(lastTimeStr);
            [1, 2, 3].forEach(t => {
                const startStr = schedule[`t${t}`];
                const reqMin = parseInt(schedule[`t${t}_req`]) || 0;
                if (startStr && finishMin >= (timeToMin(startStr) + reqMin)) recognizedSet.add(t);
            });
        }
    }
    // 3) 현재 진행 중인 상태 (실시간 계산)
    else if (["입실", "복귀", "외출"].includes(log.status)) {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

        if (log.date === todayStr) {
            const currentMin = now.getHours() * 60 + now.getMinutes();

            [1, 2, 3].forEach(t => {
                const startStr = schedule[`t${t}`];
                const reqMin = parseInt(schedule[`t${t}_req`]) || 0;
                if (startStr && currentMin >= (timeToMin(startStr) + reqMin)) recognizedSet.add(t);
            });

            // 외출 중일 때는 현재 겹쳐있는 타임은 인정하지 않음
            if (log.status === "외출") {
                let currentSlot = 1;
                if (currentMin >= timeToMin(schedule.t3 || "20:10")) currentSlot = 3;
                else if (currentMin >= timeToMin(schedule.t2 || "18:50")) currentSlot = 2;
                recognizedSet.delete(currentSlot);
            }
        }
    }
    return recognizedSet;
}




// =======================================================
// 🌟 [공통] 학생 상세 출결 달력 모달 (여러 페이지에서 재사용)
// =======================================================

// 1. 모달 HTML 동적 주입 함수
function injectCalendarModalHtml() {
    if (document.getElementById('shared-student-calendar-modal')) return; // 이미 있으면 생성 안함

    const modalHtml = `
    <div id="shared-student-calendar-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:15px; width:95%; max-width:650px; overflow-y:auto; max-height:90vh; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #007bff; padding-bottom:10px;">
                <h3 id="shared-sc-title" style="margin:0; font-size: 18px; color:#1a1a1a;">🧑‍🎓 학생 상세 출결 달력</h3>
                <button style="padding: 5px 12px; border-radius:6px; font-size:13px; background:#6c757d; color:white; border:none; cursor:pointer;" onclick="document.getElementById('shared-student-calendar-modal').style.display='none'">닫기</button>
            </div>
            <div id="shared-sc-calendar-area" style="margin-top: 15px;"></div>
            <div style="background:#f8f9fa; padding:15px; border-radius:10px; margin-top:15px; display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:13px; text-align:center; border: 1px solid #eee;">
                <div>신청 타임<br><b id="shared-sc-total-apply" style="color:#007bff; font-size:18px;">0</b>회</div>
                <div>출석 타임<br><b id="shared-sc-total-present" style="color:#28a745; font-size:18px;">0</b>회</div>
                <div>참여율<br><b id="shared-sc-rate" style="color:#dc3545; font-size:18px;">0</b>%</div>
            </div>
            <div id="shared-sc-comment" style="margin-top:15px; padding:12px; background:#eef6ff; border-radius:8px; font-size:14px; font-weight:bold; text-align:center; color:#052c65;"></div>
            <div style="margin-top:10px; text-align:center; font-size:11px; color:#666;">
                <span style="display:inline-block; padding:2px 8px; background:#007bff; color:white; border-radius:3px; margin-right:5px;">■</span>출석/인정
                <span style="display:inline-block; padding:2px 8px; background:#fff0f0; border:1px solid #dc3545; color:#dc3545; border-radius:3px; margin:0 5px;">■</span>미입실(결석)
                <span style="display:inline-block; padding:2px 8px; background:transparent; border:1px solid #f0f0f0; color:#ccc; border-radius:3px; margin-left:5px;">■</span>미신청 타임
            </div>
        </div>
    </div>
    <div id="shared-daily-detail-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:10000; justify-content:center; align-items:center;">
        <div style="background:white; padding:20px; border-radius:12px; width:90%; max-width:400px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #ccc; padding-bottom:10px; margin-bottom:15px;">
                <h4 id="shared-dd-title" style="margin:0; font-size:16px; color:#333;">📅 00월 00일 상세 기록</h4>
                <button style="padding:4px 8px; font-size:12px; background:#6c757d; color:white; border:none; cursor:pointer; border-radius:4px;" onclick="document.getElementById('shared-daily-detail-modal').style.display='none'">닫기</button>
            </div>
            <div style="margin-bottom:10px; font-size:13px;"><b>최종 상태:</b> <span id="shared-dd-status" style="font-weight:bold;"></span></div>
            <div style="background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #eee;">
                <b style="font-size:13px; color:#555; display:block; margin-bottom:10px;">🕒 실제 태그(스캔) 흐름</b>
                <div id="shared-dd-history" style="font-size:13px; line-height:1.6; color:#333;"></div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 2. 모달 열기 함수 (DB에서 데이터 독립적 조회)
async function openSharedStudentCalendar(stuId, stuName, targetYear, targetMonthNum) {
    injectCalendarModalHtml();

    document.getElementById('shared-student-calendar-modal').style.display = 'flex';
    document.getElementById('shared-sc-title').innerText = `⏳ 데이터를 불러오는 중...`;
    document.getElementById('shared-sc-calendar-area').innerHTML = `<div style="text-align:center; padding:50px; font-weight:bold; color:#007bff;">데이터를 분석 중입니다... 잠시만 기다려주세요.</div>`;

    const targetMonthStr = targetMonthNum + "월";
    const startDate = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}-01`;
    const lastDateObj = new Date(targetYear, targetMonthNum, 0);
    const endDate = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}-${String(lastDateObj.getDate()).padStart(2, '0')}`;

    try {

        // 🌟 수정: 시간표(schedule) 데이터도 함께 가져오도록 추가
        const [{ data: appData }, { data: logsData }, { data: calSettings }, { data: schedSettings }] = await Promise.all([
            supabaseClient.from('applications').select('*').eq('stu_id', stuId).eq('target_month', targetMonthStr).maybeSingle(),
            supabaseClient.from('attendance_logs').select('date, status, history').eq('stu_id', stuId).gte('date', startDate).lte('date', endDate),
            supabaseClient.from('settings').select('value').eq('key', 'calendarSchedule').maybeSingle(),
            supabaseClient.from('settings').select('value').eq('key', 'schedule').maybeSingle()
        ]);

        let currentSchedule = { t1: "16:00", t2: "18:50", t3: "20:10" };
        if (schedSettings && schedSettings.value) {
            currentSchedule = { ...currentSchedule, ...schedSettings.value };
        }

        document.getElementById('shared-sc-title').innerText = `🧑‍🎓 ${stuName} (${stuId}) - ${targetMonthNum}월 출결 달력`;


        let calSchedule = { data: {}, defaultDays: [1, 2, 3, 4, 5] };
        if (calSettings && calSettings.value) {
            if (calSettings.value.data) calSchedule.data = JSON.parse(calSettings.value.data);
            if (calSettings.value.defaultDays) calSchedule.defaultDays = calSettings.value.defaultDays;
        }

        const studentLogs = logsData || [];
        const firstDay = new Date(targetYear, targetMonthNum - 1, 1).getDay();
        const lastDate = lastDateObj.getDate();
        const daysEng = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

        let html = `<table style="width: 100%; border-collapse: collapse; table-layout: fixed; font-size:12px;">
            <thead><tr>
                <th style="color:#dc3545; padding:8px; background:#e9ecef; border:1px solid #dee2e6;">일</th>
                <th style="padding:8px; background:#e9ecef; border:1px solid #dee2e6;">월</th>
                <th style="padding:8px; background:#e9ecef; border:1px solid #dee2e6;">화</th>
                <th style="padding:8px; background:#e9ecef; border:1px solid #dee2e6;">수</th>
                <th style="padding:8px; background:#e9ecef; border:1px solid #dee2e6;">목</th>
                <th style="padding:8px; background:#e9ecef; border:1px solid #dee2e6;">금</th>
                <th style="color:#0d6efd; padding:8px; background:#e9ecef; border:1px solid #dee2e6;">토</th>
            </tr></thead><tbody><tr>`;

        let tApply = 0, tPresent = 0;
        for (let i = 0; i < firstDay; i++) html += `<td style="border:1px solid #dee2e6; height:70px;"></td>`;

        for (let d = 1; d <= lastDate; d++) {
            const dateStr = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayIdx = new Date(targetYear, targetMonthNum - 1, d).getDay();
            const dayKey = daysEng[dayIdx];

            let isOperating = calSchedule.defaultDays.includes(dayIdx);
            let reason = "";
            if (calSchedule.data[dateStr] !== undefined) {
                isOperating = calSchedule.data[dateStr].active;
                reason = calSchedule.data[dateStr].reason;
            }

            const dailyLog = studentLogs.find(l => l.date === dateStr);
            let slotHtml = `<div style="display:flex; flex-direction:column; gap:2px; margin-top:2px;">`;

            if (!isOperating) {
                slotHtml += `<div style="font-size:9px; color:#dc3545; font-weight:bold; margin-top:10px; text-align:center;">${reason || "미운영"}</div>`;
            } else {
                const appliedStr = (appData && appData[dayKey]) ? appData[dayKey] : "";
                const appliedTimes = appliedStr.split(',').filter(v => v.trim());




                // 🌟 수정: 복잡한 로직 모두 지우고 공통 함수 하나로 통합!
                const recognizedSet = getRecognizedTimes(dailyLog, currentSchedule);


                [1, 2, 3].forEach(t => {
                    const isApplied = appliedTimes.includes(String(t));
                    const isRecognized = recognizedSet.has(t); // 🌟 공통 함수의 결과(실제 출석)

                    let leftBg = "transparent", leftCol = "#ccc", borderColor = "#f0f0f0", rightBg = "transparent";

                    // 1. 기본 신청 여부에 따른 왼쪽(1T, 2T 글씨) 바탕색
                    if (isApplied) {
                        tApply++;
                        leftBg = "#f8f9fa"; leftCol = "#333"; borderColor = "#ced4da";
                    }

                    // 2. 신청 여부 무관! 공통 함수에서 인정받았다면 오른쪽을 무조건 파란색으로 칠함!
                    if (isRecognized) {
                        tPresent++;
                        rightBg = "#007bff"; // 출석 파란색

                        // 🌟 디테일: 신청 안 했는데 남아서 공부한 기특한 경우 (하늘색 테두리로 강조)
                        if (!isApplied) {
                            leftBg = "#eef6ff";
                            leftCol = "#0d6efd";
                            borderColor = "#b6d4fe";
                        }
                    }
                    // 3. 신청했는데 인정 못 받은 경우 (결석 빨간색)
                    else if (isApplied) {
                        rightBg = "#ff9999";
                    }

                    slotHtml += `
            <div style="display:flex; width:100%; height:18px; font-size:10px; font-weight:bold; border-radius:3px; overflow:hidden; border:1px solid ${borderColor}; margin-bottom:1px;">
                <div style="flex:2; display:flex; justify-content:center; align-items:center; background:${leftBg}; color:${leftCol};">${t}T</div>
                <div style="flex:1; background:${rightBg}; border-left:1px solid ${borderColor};"></div>
            </div>`;
                });



            }
            slotHtml += `</div>`;

            let dateColor = dayIdx === 0 ? "color:#dc3545;" : (dayIdx === 6 ? "color:#0d6efd;" : "color:#333;");
            const statusVal = dailyLog ? dailyLog.status : '미입실';
            const historyArrStr = (dailyLog && dailyLog.history) ? JSON.stringify(dailyLog.history).replace(/"/g, '&quot;') : '[]';

            html += `<td style="border:1px solid #dee2e6; height:70px; padding:6px; vertical-align:top; background:white; cursor:pointer; transition:0.2s;"
                 onclick='openSharedDailyDetail("${dateStr}", "${statusVal}", ${historyArrStr})'
                 onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='white'">
                <div style="font-weight:bold; margin-bottom:2px; font-size:12px; ${dateColor}">${d}</div>
                ${slotHtml}
            </td>`;

            if ((firstDay + d) % 7 === 0 && d !== lastDate) html += `</tr><tr>`;
        }

        const lastDayIdx = new Date(targetYear, targetMonthNum - 1, lastDate).getDay();
        if (lastDayIdx < 6) {
            for (let i = lastDayIdx + 1; i <= 6; i++) html += `<td style="border:1px solid #dee2e6; height:70px;"></td>`;
        }
        html += `</tr></tbody></table>`;

        document.getElementById('shared-sc-calendar-area').innerHTML = html;

        const rate = tApply > 0 ? Math.round((tPresent / tApply) * 100) : 0;
        document.getElementById('shared-sc-total-apply').innerText = tApply;
        document.getElementById('shared-sc-total-present').innerText = tPresent;
        document.getElementById('shared-sc-rate').innerText = rate + "%";

        let comment = "이번 달 신청 데이터가 없습니다.";
        if (tApply > 0) {
            if (rate >= 80) comment = "✨ 훌륭합니다! 성실하게 참여하고 있습니다.";
            else if (rate >= 60) comment = "🙂 무난하게 참여 중이나, 결석한 날의 사유 확인이 필요합니다.";
            else comment = "🚨 잦은 결석이 확인됩니다! 학생과의 깊은 상담을 권장합니다.";
        }
        document.getElementById('shared-sc-comment').innerText = comment;

    } catch (e) {
        console.error(e);
        document.getElementById('shared-sc-calendar-area').innerHTML = `<div style="text-align:center; padding:50px; color:red;">데이터를 불러오는 중 오류가 발생했습니다.<br>${e.message}</div>`;
    }
}

function openSharedDailyDetail(dateStr, status, historyList) {
    const [y, m, d] = dateStr.split('-');
    document.getElementById('shared-dd-title').innerText = `📅 ${parseInt(m)}월 ${parseInt(d)}일 상세 기록`;

    let statusColor = "#dc3545";
    if (status === "입실" || status === "복귀") statusColor = "#007bff";
    else if (status === "외출") statusColor = "#fd7e14";
    else if (status === "귀가" || status === "귀가(누락)") statusColor = "#6c757d";

    document.getElementById('shared-dd-status').innerHTML = `<span style="color:${statusColor}">${status}</span>`;

    let historyHtml = "";
    if (!historyList || historyList.length === 0) {
        historyHtml = "<div style='color:#999; text-align:center; padding:10px 0;'>키오스크 태그 기록이 없습니다.</div>";
    } else {
        historyList.forEach((h, idx) => {
            let bg = "#e7f1ff", col = "#007bff", border = "#b6d4fe";
            if (h.includes("교사") || h.includes("빈자리")) { bg = "#f3e8ff"; col = "#5b21b6"; border = "#8b5cf6"; }
            else if (h.includes("외출")) { bg = "#fff3cd"; col = "#b38200"; border = "#ffe69c"; }
            else if (h.includes("귀가") || h.includes("누락")) { bg = "#fff0f0"; col = "#dc3545"; border = "#f5c2c7"; }

            historyHtml += `<div style="margin-bottom:8px; display:flex; align-items:center;">
            <span style="display:inline-block; width:25px; text-align:center; color:#adb5bd; font-size:12px; font-weight:bold;">${idx + 1}.</span> 
            <span style="display:inline-block; background:${bg}; color:${col}; border:1px solid ${border}; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">${h}</span>
        </div>`;
        });
    }
    document.getElementById('shared-dd-history').innerHTML = historyHtml;
    document.getElementById('shared-daily-detail-modal').style.display = 'flex';
}

// =======================================================
// 🌟 [공통 유틸리티] 날짜 및 시간 계산 함수
// =======================================================

/**
 * 한국 시간(KST) 기준 오늘 날짜 문자열 반환 (YYYY-MM-DD 형식)
 */
function getTodayString() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

/**
 * 특정 시간 문자열(HH:MM)에 지정된 분(minutes)을 더하여 새로운 시간 문자열 반환
 * @param {string} timeStr - 기준 시간 (예: "16:00")
 * @param {number} minsToAdd - 더할 분 (예: 30)
 */
function addMinutesToTime(timeStr, minsToAdd) {
    if (!timeStr) return "22:00"; // 값이 없을 경우의 기본값
    const [hh, mm] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hh);
    date.setMinutes(mm + minsToAdd);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 로그아웃 기능 예시 (common.js 맨 아래 추가)
async function adminLogout() {
    if (confirm("관리자 계정에서 로그아웃 하시겠습니까?")) {
        await supabaseClient.auth.signOut();
        alert("로그아웃 되었습니다.");
        location.reload(); // 새로고침하여 화면 잠금
    }
}