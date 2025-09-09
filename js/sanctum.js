// js/sanctum.js
// Requires js/config.js to have created `supabase`.

const params = new URLSearchParams(location.search);
const memberFromUrl = params.get('member_id') || null;

// UI elements
const welcomeMessage = document.getElementById('welcomeMessage');
const pointsDisplay = document.getElementById('pointsDisplay');
const redeemBtn = document.getElementById('redeemBtn');
const redeemInput = document.getElementById('redeemCode');
const redeemMessage = document.getElementById('redeemMessage');
const activityList = document.getElementById('activity');
const logoutBtn = document.getElementById('logoutBtn');
const copyLink = document.getElementById('copyLink');
const sessionInfo = document.getElementById('sessionInfo');

let MEMBER = null; // holds member data

// init sequence
(async function init() {
    // try restore from localStorage if no url param
    const stored = localStorage.getItem('koyo_member');
    if (!memberFromUrl && stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.member_id) {
                // move to sanctum with that id
                history.replaceState({}, '', `sanctum.html?member_id=${encodeURIComponent(parsed.member_id)}`);
            }
        } catch (e) { }
    }

    const memberId = memberFromUrl || (stored ? JSON.parse(stored).member_id : null);
    if (!memberId) {
        // no member -> redirect to landing
        window.location.href = 'index.html';
        return;
    }

    await loadMember(memberId);
    attachHandlers();
})();

async function loadMember(memberId) {
    try {
        // Check if Supabase is ready
        if (!window.supabase) {
            console.error('Supabase not initialized');
            window.location.href = 'index.html';
            return;
        }

        // SECURITY: Validate session before loading member data
        const stored = localStorage.getItem('koyo_member');
        if (!stored) {
            console.log('No valid session found');
            window.location.href = 'index.html';
            return;
        }

        let sessionData;
        try {
            sessionData = JSON.parse(stored);
        } catch (e) {
            console.log('Invalid session data');
            window.location.href = 'index.html';
            return;
        }

        // Verify the member_id matches the session
        if (sessionData.member_id !== memberId) {
            console.log('Session member_id does not match URL member_id');
            window.location.href = 'index.html';
            return;
        }

        // Verify session has required data
        if (!sessionData.access_code) {
            console.log('No access code in session');
            window.location.href = 'index.html';
            return;
        }

        // Check if session has expired
        if (sessionData.expiresAt && Date.now() > sessionData.expiresAt) {
            console.log('Session expired');
            localStorage.removeItem('koyo_member');
            window.location.href = 'index.html';
            return;
        }

        const { data, error } = await window.supabase.from('members').select('member_id, points').eq('member_id', memberId).maybeSingle();
        if (error || !data) {
            console.error(error);
            window.location.href = 'index.html';
            return;
        }
        MEMBER = data;

        // update UI
        welcomeMessage.textContent = `Welcome to the Sanctum, ${MEMBER.member_id}`;
        animatePoints(0, Number(MEMBER.points || 0));
        loadActivity();
        updateSessionInfo();

        // Don't overwrite the session with REDACTED - keep the original session data
        // The session should already be valid from the login process
    } catch (e) {
        console.error(e);
        window.location.href = 'index.html';
    }
}

function attachHandlers() {
    if (redeemBtn) redeemBtn.addEventListener('click', redeemCode);
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (copyLink) copyLink.addEventListener('click', copyMemberLink);

    // Add Enter key support for redeem code input
    if (redeemInput) {
        redeemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !redeemBtn.disabled) {
                redeemCode();
            }
        });
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to focus redeem input
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (redeemInput) {
                redeemInput.focus();
            }
        }
        // Escape to clear redeem input
        if (e.key === 'Escape' && redeemInput) {
            redeemInput.value = '';
            redeemInput.blur();
        }
    });
}

async function redeemCode() {
    const code = (redeemInput.value || '').trim();
    redeemMessage.textContent = '';
    if (!code) {
        redeemMessage.textContent = 'Enter a scratch code.';
        redeemMessage.style.color = '#ff7b7b';
        return;
    }
    if (!MEMBER) { location.href = 'index.html'; return; }

    // Check if Supabase is ready
    if (!window.supabase) {
        redeemMessage.textContent = 'Loading... Please wait a moment and try again.';
        redeemMessage.style.color = '#ff7b7b';
        return;
    }

    // Add loading state
    const originalText = redeemBtn.textContent;
    redeemBtn.disabled = true;
    redeemBtn.textContent = 'Redeeming...';
    redeemInput.disabled = true;

    try {
        // fetch code row in one query
        const { data: codeRow, error: codeErr } = await window.supabase.from('codes').select('code, points, used').eq('code', code).maybeSingle();
        if (codeErr) { throw codeErr; }
        if (!codeRow) {
            redeemMessage.textContent = 'Invalid code.';
            redeemMessage.style.color = '#ff7b7b';
            // Reset button state
            redeemBtn.disabled = false;
            redeemBtn.textContent = originalText;
            redeemInput.disabled = false;
            return;
        }
        if (codeRow.used) {
            redeemMessage.textContent = 'Code already used.';
            redeemMessage.style.color = '#ff7b7b';
            // Reset button state
            redeemBtn.disabled = false;
            redeemBtn.textContent = originalText;
            redeemInput.disabled = false;
            return;
        }

        // mark code as used, assign to member (two updates)
        const { error: useErr } = await window.supabase.from('codes').update({ used: true, member_id: MEMBER.member_id }).eq('code', code);
        if (useErr) { throw useErr; }

        // update member points (read fresh then update)
        const newPoints = Number(MEMBER.points || 0) + Number(codeRow.points || 0);
        const { error: mErr } = await window.supabase.from('members').update({ points: newPoints }).eq('member_id', MEMBER.member_id);
        if (mErr) { throw mErr; }

        // update local UI
        animatePoints(Number(MEMBER.points || 0), newPoints);
        MEMBER.points = newPoints;
        redeemMessage.textContent = `+${codeRow.points} points added ✨`;
        redeemMessage.style.color = '#9fe9b1';
        redeemInput.value = '';
        prependActivity(`${code} (+${codeRow.points} pts)`);

        // Add success animation
        redeemBtn.classList.add('success-pulse');
        setTimeout(() => redeemBtn.classList.remove('success-pulse'), 600);

        // Reset button state
        redeemBtn.disabled = false;
        redeemBtn.textContent = originalText;
        redeemInput.disabled = false;
    } catch (e) {
        console.error(e);
        redeemMessage.textContent = 'Network error — try again.';
        redeemMessage.style.color = '#ff7b7b';

        // Reset button state
        redeemBtn.disabled = false;
        redeemBtn.textContent = originalText;
        redeemInput.disabled = false;
    }
}

function animatePoints(from, to) {
    const el = pointsDisplay;

    if (!el) {
        console.error('Points display element not found');
        return;
    }

    const duration = 700;
    const frameRate = 40;
    const totalFrames = Math.round(duration / (1000 / frameRate));
    let frame = 0;
    const diff = to - from;
    const id = setInterval(() => {
        frame++;
        const progress = easeOutCubic(frame / totalFrames);
        el.textContent = Math.round(from + diff * progress);
        if (frame >= totalFrames) {
            clearInterval(id);
            el.textContent = `${to} pts`;
        }
    }, 1000 / frameRate);
    function easeOutCubic(t) { return (--t) * t * t + 1; }
}

async function loadActivity() {
    if (!MEMBER) return;
    try {
        const { data } = await window.supabase.from('codes').select('code, points, member_id').eq('member_id', MEMBER.member_id).order('code', { ascending: false }).limit(8);
        activityList.innerHTML = '';
        (data || []).forEach(r => {
            const li = document.createElement('li');
            li.textContent = `${r.code} (+${r.points} pts)`;
            activityList.appendChild(li);
        });
    } catch (e) { console.error(e); }
}

function prependActivity(text) {
    const li = document.createElement('li');
    li.textContent = text;
    activityList.prepend(li);
}

// copy member link (quick sharing)
function copyMemberLink() {
    if (!MEMBER) return;
    const url = `${location.origin}/sanctum.html?member_id=${encodeURIComponent(MEMBER.member_id)}`;
    navigator.clipboard?.writeText(url).then(() => alert('Member link copied'));
}

// Update session info display
function updateSessionInfo() {
    if (!sessionInfo) return;

    const stored = localStorage.getItem('koyo_member');
    if (!stored) return;

    try {
        const sessionData = JSON.parse(stored);
        if (sessionData.expiresAt) {
            const now = Date.now();
            const timeLeft = sessionData.expiresAt - now;

            if (timeLeft <= 0) {
                sessionInfo.textContent = 'Session expired';
                sessionInfo.style.color = '#ff6b6b';
                return;
            }

            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

            if (hours > 0) {
                sessionInfo.textContent = `${hours}h ${minutes}m left`;
            } else {
                sessionInfo.textContent = `${minutes}m left`;
            }

            if (timeLeft < 30 * 60 * 1000) { // Less than 30 minutes
                sessionInfo.style.color = '#ff9500';
            } else {
                sessionInfo.style.color = 'var(--muted)';
            }
        }
    } catch (e) {
        console.error('Error updating session info:', e);
    }
}

// Update session info every minute (only if page is visible)
let sessionUpdateInterval;
function startSessionUpdates() {
    if (sessionUpdateInterval) clearInterval(sessionUpdateInterval);
    sessionUpdateInterval = setInterval(updateSessionInfo, 60000);
}

// Pause updates when page is hidden to save resources
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (sessionUpdateInterval) clearInterval(sessionUpdateInterval);
    } else {
        updateSessionInfo(); // Update immediately when page becomes visible
        startSessionUpdates();
    }
});

startSessionUpdates();

// logout
function logout() {
    localStorage.removeItem('koyo_member');
    window.location.href = 'index.html';
}
