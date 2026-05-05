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
        // 병렬로 데이터 가져오기
        const [{ data: appData }, { data: logsData }, { data: calSettings }] = await Promise.all([
            supabaseClient.from('applications').select('*').eq('stu_id', stuId).eq('target_month', targetMonthStr).maybeSingle(),
            supabaseClient.from('attendance_logs').select('date, status, history').eq('stu_id', stuId).gte('date', startDate).lte('date', endDate),
            supabaseClient.from('settings').select('value').eq('key', 'calendarSchedule').maybeSingle()
        ]);

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

                const recognizedCount = (typeof getRecognizedTimes === 'function')
                    ? getRecognizedTimes(dailyLog, appliedStr)
                    : (dailyLog && dailyLog.status !== "미입실" ? appliedTimes.length : 0);

                [1, 2, 3].forEach(t => {
                    const isApplied = appliedTimes.includes(String(t));
                    let leftBg = "transparent", leftCol = "#ccc", borderColor = "#f0f0f0", rightBg = "transparent";

                    if (isApplied) {
                        tApply++;
                        leftBg = "#f8f9fa"; leftCol = "#333"; borderColor = "#ced4da";
                        const appliedIndex = appliedTimes.indexOf(String(t)) + 1;
                        if (appliedIndex <= recognizedCount) {
                            rightBg = "#007bff";
                            tPresent++;
                        } else {
                            rightBg = "#ff9999";
                        }
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