const supabaseUrl = 'https://oacwydxlrrctxmavodmt.supabase.co'; // Replace with your Supabase URL
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hY3d5ZHhscnJjdHhtYXZvZG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUwNTY5NDgsImV4cCI6MjA0MDYzMjk0OH0.tHHtD_AbhMJAI6KtfIQJWHIU7w7gLrlQPCX_56kAVXI'; // Replace with your Supabase Key
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Authentication
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
        alert(error.message);
    } else {
        console.log('User signed up:', user);
        alert('Sign up successful!');
    }
});

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
        alert(error.message);
    } else {
        console.log('User logged in:', user);
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('alerts-section').style.display = 'block';
        loadAlerts();
    }
});

document.getElementById('post-alert-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = document.getElementById('alert-message').value;

    const { data, error } = await supabase.from('alerts').insert([
        { 
            name: supabase.auth.user().email,
            email: supabase.auth.user().email,
            phone: '', // Add additional fields as needed
            message: message,
            location: 'Example Location', // Replace with actual location if available
            timestamp: new Date().toISOString()
        }
    ]);

    if (error) {
        console.error('Post alert error:', error.message);
        alert(error.message);
    } else {
        alert('Alert posted successfully!');
        loadAlerts();
    }
});

const loadAlerts = async () => {
    const { data, error } = await supabase
        .from('alerts')
        .select('*');

    if (error) {
        console.error('Load alerts error:', error.message);
        alert(error.message);
        return;
    }

    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';

    data.forEach(alert => {
        const alertElement = document.createElement('div');
        alertElement.textContent = `${alert.timestamp} - ${alert.message}`;
        alertsList.appendChild(alertElement);
    });
};
