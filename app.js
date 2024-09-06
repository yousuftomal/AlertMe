// Utility functions
function showError(message) {
    // Error handling removed
}

function showSuccess(message) {
    // Success message removed
}

// Authentication functions
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        // Error handling removed
        return null;
    }
}

async function signUp(name, email, phone, password) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        if (authError) throw authError;

        const user = authData.user;
        if (!user) throw new Error('User not found in sign-up response');

        const { error: insertError } = await supabase.from('users').upsert({
            id: user.id,
            full_name: name,
            phone: phone,
            email: email
        });
        if (insertError) throw insertError;

        return true;
    } catch (error) {
        // Error handling removed
        return false;
    }
}

async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) throw error;

        return true;
    } catch (error) {
        // Error handling removed
        return false;
    }
}

// Alert functions
async function postAlert(message) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', user.id)
            .single();

        if (userError) throw userError;

        const userName = userData ? userData.full_name : 'Unknown';

        const { data, error } = await supabase.from('alerts').insert({
            user_id: user.id,
            name: userName,
            message: message,
            timestamp: new Date().toISOString(),
            verified_votes: 0,
            discard_votes: 0,
            comments_count: 0
        });

        if (error) throw error;

        return true;
    } catch (error) {
        // Error handling removed
        return false;
    }
}

async function loadAlerts() {
    try {
        const { data: alerts, error } = await supabase
            .from('alerts')
            .select('*');

        if (error) throw error;

        const alertsList = document.getElementById('alerts-list');
        alertsList.innerHTML = '';

        alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = 'alert-post';

            alertElement.innerHTML = `
                <div class="alert-name">${alert.name}</div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-timestamp">${new Date(alert.timestamp).toLocaleString()}</div>
                <div class="alert-votes">
                    True: ${alert.verified_votes} | Fake: ${alert.discard_votes} | Comments: ${alert.comments_count}
                </div>
                <div class="alert-actions">
                    <button onclick="vote('${alert.id}', 'verify')">True</button>
                    <button onclick="vote('${alert.id}', 'discard')">Fake</button>
                    <button onclick="redirectToPost('${alert.id}')">Comments</button>
                    <button onclick="sharePost('${alert.id}')">Share</button>
                </div>
            `;

            alertsList.appendChild(alertElement);
        });
    } catch (error) {
        // Error handling removed
    }
}

// Vote system
async function vote(alertId, voteType) {
    try {
        const voteField = voteType === 'verify' ? 'verified_votes' : 'discard_votes';
        const user = await getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        const { data: existingVote, error: voteError } = await supabase
            .from('votes')
            .select('*')
            .eq('alert_id', alertId)
            .eq('user_id', user.id);

        if (voteError) throw voteError;
        if (existingVote.length > 0) {
            return;
        }

        const { error: insertVoteError } = await supabase.from('votes').insert({
            alert_id: alertId,
            user_id: user.id,
            vote_type: voteType
        });

        if (insertVoteError) throw insertVoteError;

        const { data: alert, error: alertError } = await supabase
            .from('alerts')
            .select('*')
            .eq('id', alertId)
            .single();

        if (alertError) throw alertError;

        const updatedVotes = voteType === 'verify' 
            ? { verified_votes: alert.verified_votes + 1 } 
            : { discard_votes: alert.discard_votes + 1 };

        const { error: updateError } = await supabase
            .from('alerts')
            .update(updatedVotes)
            .eq('id', alertId);

        if (updateError) throw updateError;

        await loadAlerts();
    } catch (error) {
        // Error handling removed
    }
}

// Comment Page Redirection
function redirectToPost(alertId) {
    window.location.href = `post.html?alertId=${alertId}`;
}

// Share Post URL
function sharePost(alertId) {
    const postUrl = `${window.location.origin}/post.html?alertId=${alertId}`;
    navigator.clipboard.writeText(postUrl).then(() => {
        // Success message removed
    }).catch(error => {
        // Error handling removed
    });
}

// Initialize the app
async function initApp() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('alerts-section').style.display = 'none';
        } else {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('alerts-section').style.display = 'block';
            await loadAlerts();
        }
    } catch (error) {
        // Error handling removed
    }
}

// Event Listeners
document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await login(email, password);
    await initApp();
});

document.getElementById('sign-up-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('sign-up-name').value;
    const email = document.getElementById('sign-up-email').value;
    const phone = document.getElementById('sign-up-phone').value;
    const password = document.getElementById('sign-up-password').value;
    await signUp(name, email, phone, password);
    await initApp();
});

document.getElementById('post-alert-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.getElementById('alert-message').value;
    await postAlert(message);
    await loadAlerts();
    document.getElementById('alert-message').value = '';
});

// Initialize on load
window.addEventListener('load', initApp);