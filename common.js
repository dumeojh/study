// ==========================================
// 파일명: common.js
// 공통 데이터베이스 설정 및 핵심 유틸리티 함수
// ==========================================

// 1. Supabase 초기화 공통 설정
const SUPABASE_URL = 'https://hqiijssfdullpfpfidbz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaWlqc3NmZHVsbHBmcGZpZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwOTUyOTgsImV4cCI6MjA5MjY3MTI5OH0.FxDFaCsqE2EwHUCbzt15aPkpFcIjXr-chjd01d87-vs';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


// 👇👇 [수정됨] 비밀번호가 보이지 않는 커스텀 인증 함수 👇👇
async function requireAdminAuth() {
    try {
        const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        let { data: { session } } = await supabaseClient.auth.getSession();
        const lastLoginDate = localStorage.getItem('adminLoginDate');

        // 1. 자정 자동 로그아웃 체크
        if (session && lastLoginDate !== todayDateStr) {
            await supabaseClient.auth.signOut();
            localStorage.removeItem('adminLoginDate');
            session = null;
            alert("보안을 위해 자정이 지나 자동으로 로그아웃 되었습니다.");
        }

        // 2. 이미 로그인된 경우 프리패스
        if (session && session.user.email === 'teacher@anseong.kr') {
            document.getElementById('main-content').style.display = 'block';
            startMidnightLogoutChecker();
            return true;
        }

        // 3. 커스텀 비밀번호 모달 띄우기
        return new Promise((resolve) => {
            // 기존 모달이 있다면 제거
            const oldModal = document.getElementById('admin-login-modal');
            if (oldModal) oldModal.remove();

            const modalHtml = `
            <div id="admin-login-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); z-index:100000; display:flex; justify-content:center; align-items:center;">
                <div style="background:white; padding:40px 30px; border-radius:20px; width:350px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.3);">
                    <div style="font-size:40px; margin-bottom:15px;">🔒</div>
                    <h3 style="margin:0 0 10px 0; color:#333; font-weight:900;">관리자 인증</h3>
                    <p style="margin:0 0 25px 0; font-size:13px; color:#666; line-height:1.4;">
                        비밀번호를 입력해주세요.<br><span style="color:#dc3545;">(입력 시 별표로 표시됩니다)</span>
                    </p>
                    <input type="password" id="admin-pwd-input" placeholder="Password" autocomplete="new-password"
                        style="width:100%; padding:12px; border:2px solid #ddd; border-radius:10px; margin-bottom:15px; font-size:16px; text-align:center; box-sizing:border-box; outline:none; transition:0.2s;">
                    
                    <div style="display: flex; gap: 10px;">
                        <button id="admin-cancel-btn" style="flex: 1; padding:12px; background:#6c757d; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer; font-size:16px;">취소</button>
                        <button id="admin-login-btn" style="flex: 1; padding:12px; background:#007bff; color:white; border:none; border-radius:10px; font-weight:bold; cursor:pointer; font-size:16px;">로그인</button>
                    </div>

                    <p style="margin-top:15px; font-size:11px; color:#999;">인증 상태는 오늘 자정까지 유지됩니다.</p>
                </div>
            </div>`;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            const input = document.getElementById('admin-pwd-input');
            const loginBtn = document.getElementById('admin-login-btn');
            const cancelBtn = document.getElementById('admin-cancel-btn'); // 취소 버튼 선택자 추가

            // 포커스 주기
            input.focus();

            // 🌟 취소 버튼 클릭 시 index.html로 돌아가기
            cancelBtn.onclick = () => {
                location.href = 'index.html';
            };

            // 로그인 실행 함수
            const attemptLogin = async () => {
                const pwd = input.value;
                if (!pwd) return;

                loginBtn.innerText = "인증 중...";
                loginBtn.disabled = true;

                const { error } = await supabaseClient.auth.signInWithPassword({
                    email: 'teacher@anseong.kr',
                    password: pwd
                });

                if (error) {
                    alert("비밀번호가 틀렸습니다.");
                    loginBtn.innerText = "로그인";
                    loginBtn.disabled = false;
                    input.value = "";
                    input.focus();
                } else {
                    localStorage.setItem('adminLoginDate', todayDateStr);
                    document.getElementById('admin-login-modal').remove();
                    document.getElementById('main-content').style.display = 'block';
                    startMidnightLogoutChecker();
                    resolve(true);
                }
            };

            // 버튼 클릭 및 엔터키 이벤트 (기존 btn 변수명을 loginBtn으로 변경)
            loginBtn.onclick = attemptLogin;
            input.onkeypress = (e) => { if (e.key === 'Enter') attemptLogin(); };

            // 입력창 테두리 효과
            input.onfocus = () => { input.style.borderColor = '#007bff'; };
            input.onblur = () => { input.style.borderColor = '#ddd'; };
        });

    } catch (err) {
        alert("인증 처리 중 오류가 발생했습니다.");
        console.error(err);
        return false;
    }
}


// 🌟 자정(24시)이 지났는지 실시간으로 감시하는 백그라운드 함수
function startMidnightLogoutChecker() {
    setInterval(() => {
        const currentToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const savedDate = localStorage.getItem('adminLoginDate');

        // 저장된 날짜가 있는데, 그게 오늘 날짜와 달라졌다면 (자정이 땡! 하고 지났다면)
        if (savedDate && savedDate !== currentToday) {
            alert("🕛 자정이 지나 보안을 위해 자동 로그아웃 처리됩니다.");
            supabaseClient.auth.signOut().then(() => {
                localStorage.removeItem('adminLoginDate');
                location.reload(); // 화면 새로고침하여 잠금
            });
        }
    }, 60000); // 1분(60000ms)마다 몰래 날짜가 바뀌었는지 검사
}
// 👆👆 [추가 끝] 👆👆


// 2. 공통 타임 인정 계산 함수 (환경설정 시간/기준 완벽 연동 버전)
function getRecognizedTimes(log, currentScheduleData) {
    const schedule = currentScheduleData || {};
    let recognizedSet = new Set(); // 인정받은 타임(1, 2, 3)을 담는 바구니

    if (!log) return recognizedSet;
    const history = log.history || [];

    // 👇👇 🌟 0순위: 관리자 강제 승인(최우선 반영) 🌟 👇👇
    const overrideLog = history.find(h => h.startsWith('🛠️[강제승인]'));
    if (overrideLog) {
        if (overrideLog.includes('0타임')) return recognizedSet; // 0타임이면 빈 바구니
        if (overrideLog.includes('1')) recognizedSet.add(1);
        if (overrideLog.includes('2')) recognizedSet.add(2);
        if (overrideLog.includes('3')) recognizedSet.add(3);
        return recognizedSet; // 강제 승인이 있으면 학생 기록 깡그리 무시하고 여기서 계산 종료!
    }
    // 👆👆 ------------------------------------------- 👆👆

    // 강제 승인이 없는 학생에 한해서만 기존 상태 감지
    if (log.status === "미입실" || log.status === "귀가(누락)") return recognizedSet;

    // 1) 관리자 수동 인정(교사) 체크
    history.forEach(h => {
        [1, 2, 3].forEach(t => {
            if (h.includes(`${t}T귀가(교사)`) || h.includes(`${t}T외출(교사)`) || h.includes(`${t}T입실(교사)`)) {
                recognizedSet.add(t);
            }
        });
    });

    // 시간(HH:MM)을 '분(minute)' 단위로 변환하는 헬퍼 함수
    const timeToMin = (tmStr) => {
        if (!tmStr) return 0;
        const [h, m] = tmStr.split(':').map(Number);
        return h * 60 + m;
    };

    // 2) 실제 자리에 앉아있던 '체류 구간(Intervals)' 추출하기
    let events = [];
    history.forEach(h => {
        if (h.includes("(교사)")) return; // 수동 기록 제외

        const match = h.match(/(\d{2}:\d{2})/);
        if (match) {
            const min = timeToMin(match[1]);
            if (h.includes("입실") || h.includes("복귀")) {
                events.push({ time: min, state: "IN" });
            }
            else if (h.includes("외출") || h.includes("귀가") || h.includes("누락") || h.includes("마감") || h.includes("결석") || h.includes("빈자리")) {
                events.push({ time: min, state: "OUT" });
            }
        }
    });

    events.sort((a, b) => a.time - b.time);

    let intervals = [];
    let currentIn = null;

    events.forEach(ev => {
        if (ev.state === "IN" && currentIn === null) {
            currentIn = ev.time;
        } else if (ev.state === "OUT" && currentIn !== null) {
            intervals.push({ start: currentIn, end: ev.time });
            currentIn = null;
        }
    });

    // 아직 집에 안 간 경우 (입실 중)
    if (currentIn !== null) {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

        if (log.date === todayStr) {
            const currentMin = now.getHours() * 60 + now.getMinutes();
            intervals.push({ start: currentIn, end: currentMin });
        } else {
            intervals.push({ start: currentIn, end: 1440 }); // 과거 비정상 마감 건 방어
        }
    }

    // 3) 🌟 환경설정(DB)에 지정된 타임별 운영시간 및 인정기준 대조
    [1, 2, 3].forEach(t => {
        if (recognizedSet.has(t)) return; // 수동 교사인정 받은 곳은 패스

        // 🎯 환경설정에서 지정한 시작, 종료, 최소 인정시간 가져오기 (설정이 없으면 기본값)
        const startStr = schedule[`t${t}`] || (t === 1 ? "16:00" : (t === 2 ? "18:50" : "20:10"));
        const endStr = schedule[`t${t}_end`] || (t === 1 ? "18:10" : (t === 2 ? "20:10" : "21:30"));
        const reqMin = parseInt(schedule[`t${t}_req`]) || 30; // 기준 시간

        const slotStart = timeToMin(startStr);
        const slotEnd = timeToMin(endStr);

        let overlapSum = 0;

        intervals.forEach(iv => {
            // 학생이 앉아있던 구간과 환경설정의 타임 구간이 겹치는 만큼만 잘라서 계산
            const overlapStart = Math.max(slotStart, iv.start);
            const overlapEnd = Math.min(slotEnd, iv.end);
            if (overlapEnd > overlapStart) {
                overlapSum += (overlapEnd - overlapStart);
            }
        });

        // 환경설정에서 정한 기준 분(reqMin)을 넘기면 최종 인정!
        if (overlapSum >= reqMin) {
            recognizedSet.add(t);
        }
    });

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

// =======================================================
// 🔒 예쁜 커스텀 로그아웃 모달 기능
// =======================================================
async function adminLogout() {
    // 1. 모달 배경(Overlay) 동적 생성
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center;
        z-index: 100000; opacity: 0; transition: opacity 0.3s ease;
    `;

    // 2. 모달 컨텐츠(Box) 생성
    const box = document.createElement('div');
    box.style.cssText = `
        background: white; padding: 35px 25px; border-radius: 20px;
        width: 320px; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        transform: translateY(20px); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    // 내부 HTML 구조 설정
    box.innerHTML = `
        <div style="font-size: 45px; margin-bottom: 15px; text-shadow: 0 4px 10px rgba(0,0,0,0.1);">👋</div>
        <h3 style="margin: 0 0 8px 0; color: #212529; font-size: 20px; font-weight: 900;">로그아웃 하시겠습니까?</h3>
        <p style="margin: 0 0 25px 0; color: #6c757d; font-size: 14px;">현재 기기에서 관리자 세션이 종료됩니다.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="btn-logout-cancel" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: #f8f9fa; color: #495057; font-size: 15px; font-weight: bold; cursor: pointer; transition: 0.2s;">취소</button>
            <button id="btn-logout-confirm" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: #dc3545; color: white; font-size: 15px; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);">로그아웃</button>
        </div>
    `;

    // 화면에 추가
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 3. 애니메이션 실행 (부드럽게 나타나기)
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });

    // 4. 버튼 이벤트 연결
    // 닫기 함수
    const closeModal = () => {
        overlay.style.opacity = '0';
        box.style.transform = 'translateY(20px)';
        setTimeout(() => document.body.removeChild(overlay), 300); // 애니메이션 끝난 후 삭제
    };

    // [취소] 버튼 클릭
    document.getElementById('btn-logout-cancel').onclick = closeModal;

    // [로그아웃] 버튼 클릭
    document.getElementById('btn-logout-confirm').onclick = async () => {
        const confirmBtn = document.getElementById('btn-logout-confirm');

        // 버튼 로딩 상태로 변경
        confirmBtn.innerText = "종료 중...";
        confirmBtn.style.background = "#c82333";
        confirmBtn.disabled = true;

        try {
            // DB 로그아웃 실행
            await supabaseClient.auth.signOut();

            // 성공 화면으로 스르륵 전환
            box.innerHTML = `
                <div style="font-size: 50px; margin-bottom: 10px; animation: popIn 0.5s ease;">✅</div>
                <h3 style="margin: 0 0 10px 0; color: #198754; font-size: 20px; font-weight: 900;">로그아웃 완료</h3>
                <p style="margin: 0; color: #6c757d; font-size: 14px;">안전하게 종료되었습니다.<br>잠시 후 화면이 잠깁니다.</p>
                <style>@keyframes popIn { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } }</style>
            `;

            // 1.5초 뒤에 메인 페이지로 이동
            setTimeout(() => {
                location.href = 'index.html';
            }, 1500);

        } catch (error) {
            alert("로그아웃 중 오류가 발생했습니다.");
            closeModal();
        }
    }; // btn-logout-confirm.onclick 종료
} // adminLogout 함수 종료