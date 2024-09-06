// Utility functions
function showError(message) {
    alert(`Error: ${message}`);
}

function showSuccess(message) {
    alert(`Success: ${message}`);
}

// Authentication functions
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        showError(error.message);
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
            email: email,
            phone: phone
        });
        if (insertError) throw insertError;

        showSuccess('Sign-up successful. Please check your email for confirmation.');
        return true;
    } catch (error) {
        showError(error.message);
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
        showError(error.message);
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

        const { error: insertError } = await supabase.from('alerts').insert({
            user_id: user.id,
            name: userName,
            message: message,
            timestamp: new Date().toISOString(),
            verified_votes: 0,
            discard_votes: 0,
            comments_count: 0
        });

        if (insertError) throw insertError;

        showSuccess('Alert posted successfully.');
        return true;
    } catch (error) {
        showError(error.message);
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
        showError(error.message);
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
            showError('You have already voted on this alert.');
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

        showSuccess('Vote recorded.');
        await loadAlerts();
    } catch (error) {
        showError(error.message);
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
        showSuccess('Post URL copied to clipboard.');
    }).catch(err => {
        showError('Failed to copy URL.');
    });
}

// Form handling
document.getElementById('create-account-button').addEventListener('click', () => {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('sign-up-page').style.display = 'block';
});

document.getElementById('back-to-login-button').addEventListener('click', () => {
    document.getElementById('sign-up-page').style.display = 'none';
    document.getElementById('login-page').style.display = 'block';
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const success = await login(email, password);
    if (success) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('alerts-section').style.display = 'block';
        await loadAlerts();
    }
});

document.getElementById('sign-up-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('sign-up-name').value;
    const email = document.getElementById('sign-up-email').value;
    const phone = document.getElementById('sign-up-phone').value;
    const password = document.getElementById('sign-up-password').value;
    const success = await signUp(name, email, phone, password);
    if (success) {
        document.getElementById('sign-up-page').style.display = 'none';
        document.getElementById('login-page').style.display = 'block';
    }
});

document.getElementById('post-alert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('alert-message').value;
    const success = await postAlert(message);
    if (success) {
        document.getElementById('alert-message').value = '';
        await loadAlerts();
    }
});

// Check session on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: session, error } = await supabase.auth.getSession();
        if (error) throw error;

        const user = session.session ? session.session.user : null;

        if (!user) {
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('alerts-section').style.display = 'none';
        } else {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('alerts-section').style.display = 'block';
            await loadAlerts();
        }
    } catch (error) {
        showError('Failed to load session.');
    }
});

