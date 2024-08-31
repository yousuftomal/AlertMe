// Supabase configuration
const supabaseUrl = 'https://oacwydxlrrctxmavodmt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY3d5ZHhscnJjdHhtYXZvZG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUwNTY5NDgsImV4cCI6MjA0MDYzMjk0OH0.tHHtD_AbhMJAI6KtfIQJWHIU7w7gLrlQPCX_56kAVXI'; // Replace with your Supabase Key
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Sign Up
document.getElementById('sign-up-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('sign-up-name').value;
    const email = document.getElementById('sign-up-email').value;
    const phone = document.getElementById('sign-up-phone').value;
    const password = document.getElementById('sign-up-password').value;

    const { user, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        console.error('Sign up error:', error.message);
        alert('Sign up failed. Please try again.');
    } else {
        await supabase.from('users').insert({
            id: user.id,
            full_name: name,
            phone: phone,
            email: email,
            location: null // Optional
        });

        alert('Sign up successful!');
    }
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { user, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error('Login error:', error.message);
        alert('Login failed. Please check your credentials.');
    } else {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('alerts-section').style.display = 'block';
        await loadAlerts();
    }
});

// Post Alert
document.getElementById('post-alert-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = document.getElementById('alert-message').value;
    const user = supabase.auth.user();

    if (user) {
        try {
            const location = await getLocation(); // Fetch user location

            await supabase.from('alerts').insert({
                user_id: user.id,
                name: user.email, // or use additional user details
                email: user.email,
                phone: '', // Optional
                message: message,
                location: `POINT(${location.lat} ${location.lng})`,
                timestamp: new Date().toISOString(),
                verified_votes: 0,
                discard_votes: 0
            });

            // Notify nearby users
            await notifyUsers(location, message);

            alert('Alert posted successfully!');
            await loadAlerts();
        } catch (error) {
            console.error('Post alert error:', error.message);
            alert('Failed to post alert. Please try again.');
        }
    } else {
        alert('Please log in first.');
    }
});

// Load Alerts
const loadAlerts = async () => {
    const user = supabase.auth.user();

    if (user) {
        const location = await getLocation();
        const radius = 50; // Radius in kilometers

        const { data: alerts, error } = await supabase
            .from('alerts')
            .select('*');

        if (error) {
            console.error('Load alerts error:', error.message);
            alert('Failed to load alerts.');
            return;
        }

        const alertsList = document.getElementById('alerts-list');
        alertsList.innerHTML = '';

        alerts.forEach(alert => {
            const alertLocation = alert.location.split(' '); // Extract latitude and longitude from POINT format
            if (isWithinRadius(location, { lat: parseFloat(alertLocation[0]), lng: parseFloat(alertLocation[1]) }, radius)) {
                const alertElement = document.createElement('div');
                alertElement.innerHTML = `
                    <p>${new Date(alert.timestamp).toLocaleString()} - ${alert.message}</p>
                    <button onclick="vote('${alert.id}', 'verify')">Verify (${alert.verified_votes})</button>
                    <button onclick="vote('${alert.id}', 'discard')">Discard (${alert.discard_votes})</button>
                `;
                alertsList.appendChild(alertElement);
            }
        });
    }
};

// Vote
const vote = async (alertId, voteType) => {
    const user = supabase.auth.user();

    if (user) {
        const { data: existingVote, error: voteError } = await supabase
            .from('votes')
            .select('*')
            .eq('alert_id', alertId)
            .eq('user_id', user.id);

        if (voteError) {
            console.error('Vote check error:', voteError.message);
            alert('Error checking vote.');
            return;
        }

        if (existingVote.length === 0) {
            await supabase.from('votes').insert({
                alert_id: alertId,
                user_id: user.id,
                vote_type: voteType
            });

            const alertRef = supabase.from('alerts').select('*').eq('id', alertId);
            const alertData = (await alertRef).data[0];

            if (voteType === 'verify') {
                await supabase.from('alerts').update({ verified_votes: alertData.verified_votes + 1 }).eq('id', alertId);
            } else {
                await supabase.from('alerts').update({ discard_votes: alertData.discard_votes + 1 }).eq('id', alertId);
            }

            alert('Vote recorded!');
            await loadAlerts();
        } else {
            alert('You have already voted on this alert.');
        }
    } else {
        alert('Please log in first.');
    }
};

// Notify Nearby Users
const notifyUsers = async (alertLocation, message) => {
    // Implement notification logic based on proximity
};

// Helper Functions
const getLocation = async () => {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            (error) => reject('Unable to retrieve location')
        );
    });
};

const isWithinRadius = (userLocation, alertLocation, radius) => {
    // Calculate distance between two geo points and check if it's within the given radius
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = toRad(alertLocation.lat - userLocation.lat);
    const dLng = toRad(alertLocation.lng - userLocation.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(userLocation.lat)) * Math.cos(toRad(alertLocation.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    return distance <= radius;
};

const toRad = (value) => value * Math.PI / 180;
