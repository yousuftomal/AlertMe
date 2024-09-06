// Get alert ID from URL
const urlParams = new URLSearchParams(window.location.search);
const alertId = urlParams.get('alertId');

async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        return null;
    }
}

async function loadPostDetails() {
    try {
        const { data: post, error } = await supabase
            .from('alerts')
            .select('*')
            .eq('id', alertId)
            .single();

        if (error) throw error;

        const postDetails = document.getElementById('post-details');
        if (!postDetails) {
            return;
        }

        postDetails.innerHTML = `
            <div class="alert-name">${post.name}</div>
                <div class="alert-message">${post.message}</div>
                <div class="alert-timestamp">${new Date(post.timestamp).toLocaleString()}</div>
                <div class="alert-votes">
                    True: ${post.verified_votes} | Fake: ${post.discard_votes} | Comments: ${post.comments_count}
                </div>
        `;
    } catch (error) {
        const postDetails = document.getElementById('post-details');
        if (postDetails) {
            postDetails.innerHTML = `<p>Error loading post</p>`;
        }
    }
}

async function loadComments() {
    try {
        // Fetch comments for the alert
        const { data: comments, error } = await supabase
            .from('comments')
            .select('*')
            .eq('alert_id', alertId);

        if (error) throw error;

        // Extract unique user IDs from comments
        const userIds = [...new Set(comments.map(comment => comment.user_id))];

        // Fetch user details
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('id, full_name')
            .in('id', userIds);

        if (userError) throw userError;

        // Create a map from user IDs to full names
        const userMap = new Map(users.map(user => [user.id, user.full_name]));

        const commentsList = document.getElementById('comments-list');
        if (!commentsList) {
            return;
        }

        commentsList.innerHTML = '';

        comments.forEach(comment => {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';

            const userName = userMap.get(comment.user_id) || 'Unknown User';

            commentElement.innerHTML = `
                <p><strong>${userName}</strong>: ${comment.comment_text}</p>
                <p>${new Date(comment.timestamp).toLocaleString()}</p>
            `;

            commentsList.appendChild(commentElement);
        });
    } catch (error) {
        const commentsList = document.getElementById('comments-list');
        if (commentsList) {
            commentsList.innerHTML = `<p>Error loading comments</p>`;
        }
    }
}

async function submitComment(event) {
    event.preventDefault();

    const commentText = document.getElementById('comment-text').value;
    if (!commentText) return;

    try {
        const user = await getCurrentUser();
        if (!user) throw new Error('User not authenticated');

        // Check if user ID exists in the users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single();
        
        if (userError || !userData) {
            throw new Error('User ID does not exist in the users table');
        }

        // Insert the comment
        const { error } = await supabase
            .from('comments')
            .insert({
                alert_id: alertId,
                user_id: user.id,
                comment_text: commentText,
                timestamp: new Date().toISOString()
            });

        if (error) throw error;

        // Increment comment count in `alerts`
        const { data: post, error: postError } = await supabase
            .from('alerts')
            .select('comments_count')
            .eq('id', alertId)
            .single();
        
        if (postError) throw postError;

        await supabase
            .from('alerts')
            .update({ comments_count: post.comments_count + 1 })
            .eq('id', alertId);

        document.getElementById('comment-form').reset();
        await loadComments();
    } catch (error) {
        const commentsList = document.getElementById('comments-list');
        if (commentsList) {
            commentsList.innerHTML = `<p>Error submitting comment</p>`;
        }
    }
}

// Initialize the post details and comments on page load
async function initPostPage() {
    await loadPostDetails();
    await loadComments();
}

document.getElementById('comment-form').addEventListener('submit', submitComment);
window.addEventListener('load', initPostPage);