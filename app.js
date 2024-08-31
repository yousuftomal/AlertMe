console.log("App initialized");

// Utility functions
function showError(message) {
    alert(message);
    console.error(message);
}

function showSuccess(message) {
    alert(message);
    console.log(message);
}

// New function to receive location from Android
window.receiveLocationFromAndroid = function(locationData) {
    console.log("Received location from Android:", locationData);
    updateUserLocation(locationData);
};

// New function to update user location
function updateUserLocation(location) {
    window.userLocation = location;
    console.log("User location updated:", window.userLocation);
}

async function getLocation() {
    if (window.userLocation) {
        return Promise.resolve(window.userLocation);
    }
    
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject('Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (error) => reject('Unable to retrieve location: ' + error.message)
        );
    });
}

function isWithinRadius(userLocation, alertLocation, radius) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = toRad(alertLocation.lat - userLocation.lat);
    const dLng = toRad(alertLocation.lng - userLocation.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(userLocation.lat)) * Math.cos(toRad(alertLocation.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    return distance <= radius;
}

function toRad(value) {
    return value * Math.PI / 180;
}

// Authentication functions
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        console.log('Current user:', user);
        return user;
    } catch (error) {
        showError(`Failed to get current user: ${error.message}`);
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

        // Insert user data into custom users table
        const { error: insertError } = await supabase.from('users').upsert({
            id: user.id,
            full_name: name,
            phone: phone,
            email: email,
            location: null // Optional
        });

        if (insertError) throw insertError;

        showSuccess('Sign up successful!');
        return true;
    } catch (error) {
        showError(`Sign up failed: ${error.message}`);
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

        const user = data.user;
        if (!user) throw new Error('User not found in login response');

        showSuccess('Login successful!');
        return true;
    } catch (error) {
        showError(`Login failed: ${error.message}`);
        return false;
    }
}

// Alert functions
async function postAlert(message) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        const location = await getLocation();
        console.log("Posting alert:", message, "at location:", location);

        // Fetch the user name from the users table using user_id
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
            location: `POINT(${location.lat} ${location.lng})`,
            timestamp: new Date().toISOString(),
            verified_votes: 0,
            discard_votes: 0
        });

        if (error) throw error;

        showSuccess('Alert posted successfully!');
        return true;
    } catch (error) {
        showError(`Failed to post alert: ${error.message}`);
        return false;
    }
}

async function loadAlerts() {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        const location = await getLocation();
        const radius = 50; // Radius in kilometers

        // Fetch alerts from the database
        const { data: alerts, error } = await supabase
            .from('alerts')
            .select('*');

        if (error) throw error;

        const alertsList = document.getElementById('alerts-list');
        alertsList.innerHTML = '';

        console.log("Loaded alerts:", alerts);

        // Iterate over each alert and format the output
        alerts.forEach(alert => {
            const alertLocation = alert.location.replace('POINT(', '').replace(')', '').split(' ');
            if (isWithinRadius(location, { lat: parseFloat(alertLocation[0]), lng: parseFloat(alertLocation[1]) }, radius)) {
                const alertElement = document.createElement('div');
                alertElement.className = 'alert-post';

                alertElement.innerHTML = `
                    <div class="alert-name">${alert.name}</div>
                    <div class="alert-location">LAT: ${alertLocation[0]}, LONG: ${alertLocation[1]}</div>
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-timestamp">${new Date(alert.timestamp).toLocaleDateString()} ${new Date(alert.timestamp).toLocaleTimeString()}</div>
                    <div class="alert-votes">
                        True: ${alert.verified_votes} | Fake: ${alert.discard_votes}
                    </div>
                    <div class="alert-actions">
                        <button onclick="vote('${alert.id}', 'verify')">True</button>
                        <button onclick="vote('${alert.id}', 'discard')">Fake</button>
                    </div>
                `;

                alertsList.appendChild(alertElement);
            }
        });
    } catch (error) {
        showError(`Failed to load alerts: ${error.message}`);
    }
}

async function vote(alertId, voteType) {
    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        const { data: existingVote, error: voteError } = await supabase
            .from('votes')
            .select('*')
            .eq('alert_id', alertId)
            .eq('user_id', user.id);

        if (voteError) throw voteError;

        if (existingVote.length === 0) {
            await supabase.from('votes').insert({
                alert_id: alertId,
                user_id: user.id,
                vote_type: voteType
            });

            const { data: alert, error: alertError } = await supabase
                .from('alerts')
                .select('*')
                .eq('id', alertId)
                .single();

            if (alertError) throw alertError;

            const updatedVotes = voteType === 'verify'
                ? { verified_votes: alert.verified_votes + 1 }
                : { discard_votes: alert.discard_votes + 1 };

            await supabase.from('alerts').update(updatedVotes).eq('id', alertId);

            await loadAlerts();
            showSuccess('Vote recorded successfully!');
        } else {
            showError('You have already voted on this alert.');
        }
    } 
    catch (error) {
        showError(`Failed to record vote: ${error.message}`);
    }
}

// Event Listeners
document.getElementById('sign-up-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('sign-up-name').value;
    const email = document.getElementById('sign-up-email').value;
    const phone = document.getElementById('sign-up-phone').value;
    const password = document.getElementById('sign-up-password').value;
    
    if (await signUp(name, email, phone, password)) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('alerts-section').style.display = 'block';
        await loadAlerts();
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (await login(email, password)) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('alerts-section').style.display = 'block';
        await loadAlerts();
    }
});

document.getElementById('post-alert-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('alert-message').value;
    
    if (await postAlert(message)) {
        document.getElementById('alert-message').value = '';
        await loadAlerts();
    }
});

// Initialize the app
async function initApp() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            // No user or error fetching user
            document.getElementById('auth-section').style.display = 'block';
            document.getElementById('alerts-section').style.display = 'none';
        } else {
            // User is authenticated
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('alerts-section').style.display = 'block';
            await loadAlerts();
        }
    } catch (error) {
        showError(`Failed to get current user: ${error.message}`);
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('alerts-section').style.display = 'none';
    }
}

// Call initApp when the page loads
window.addEventListener('load', initApp);