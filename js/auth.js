// Handles the simple member_id + access_code login.
// Requires js/config.js to have created `supabase`.

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    const memberId = document.getElementById('memberId').value.trim();
    const accessCode = document.getElementById('accessCode').value.trim();

    if (!memberId || !accessCode) {
        errorMessage.textContent = 'Please enter both Member ID and Access Code.';
        return;
    }

    // Check if Supabase is ready
    if (!window.supabase) {
        errorMessage.textContent = 'Loading... Please wait a moment and try again.';
        return;
    }

    // Add loading state
    const submitBtn = document.querySelector('.btn-primary');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';
    loginForm.classList.add('loading');

    try {
        // check member
        const { data, error } = await window.supabase
            .from('members')
            .select('member_id, access_code, points')
            .eq('member_id', memberId)
            .maybeSingle();

        if (error) {
            console.error('Supabase error', error);
            errorMessage.textContent = 'Unable to verify — try again in a moment.';
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            loginForm.classList.remove('loading');
            return;
        }

        if (!data || data.access_code !== accessCode) {
            errorMessage.textContent = 'The code does not unlock the Sanctum.';
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            loginForm.classList.remove('loading');
            return;
        }

        // Successful — store client session with expiration
        const rememberMe = document.getElementById('rememberMe').checked;
        const sessionDuration = rememberMe ? (7 * 24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000); // 7 days or 24 hours

        const sessionData = {
            member_id: memberId,
            access_code: accessCode,
            loginTime: Date.now(),
            expiresAt: Date.now() + sessionDuration,
            rememberMe: rememberMe
        };
        localStorage.setItem('koyo_member', JSON.stringify(sessionData));
        // small success micro-animation before redirect
        document.querySelector('.btn-primary').textContent = 'Opening Sanctum…';
        setTimeout(() => {
            window.location.href = `sanctum.html?member_id=${encodeURIComponent(memberId)}`;
        }, 350);
    } catch (err) {
        console.error('Login error:', err);
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        loginForm.classList.remove('loading');

        if (err.message.includes('Failed to fetch')) {
            errorMessage.textContent = 'Network error — please check your connection and try again.';
        } else if (err.message.includes('Invalid API key')) {
            errorMessage.textContent = 'Configuration error — please contact support.';
        } else {
            errorMessage.textContent = 'Error: ' + err.message;
        }
    }
});

// Prefill if ?member= in URL (makes QR-card links friendly)
(function prefillFromQuery() {
    try {
        const p = new URLSearchParams(location.search);
        const id = p.get('member');
        if (id) {
            document.getElementById('memberId').value = id;
            document.getElementById('accessCode').focus();
        }
    } catch (e) { }
})();
