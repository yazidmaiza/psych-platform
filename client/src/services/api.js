export const BASE_URL = 'http://localhost:5000';

const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
});

const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// Helper to refresh token and retry request
async function handleRetryWithRefresh(method, url, body = null, isFormData = false) {
    try {
        // Import refreshSession dynamically to avoid circular imports
        const { refreshSession } = await import('./auth.js');
        
        console.log('DEBUG api: Got 401, attempting token refresh...');
        await refreshSession();
        
        // Retry the request with new token
        const headers = isFormData ? getAuthHeaders() : getHeaders();
        const options = {
            method,
            headers
        };
        
        if (body) {
            if (isFormData) {
                options.body = body; // FormData, don't stringify
            } else {
                options.body = JSON.stringify(body);
            }
        }
        
        const res = await fetch(`${BASE_URL}${url}`, options);
        const data = await res.json();
        if (!res.ok) {
            const err = new Error(data.message || 'Request failed after refresh');
            err.status = res.status;
            throw err;
        }
        return data;
    } catch (err) {
        console.error('DEBUG api: Token refresh failed, logging out', err.message);
        // Clear auth and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('role');
        localStorage.removeItem('userId');
        localStorage.removeItem('isVerified');
        window.location.href = '/login';
        throw err;
    }
}

export const api = {
    get: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, { headers: getHeaders() });
        const data = await res.json();
        if (res.status === 401) {
            return handleRetryWithRefresh('GET', url);
        }
        if (!res.ok) {
            const err = new Error(data.message || 'Request failed');
            err.status = res.status;
            throw err;
        }
        return data;
    },
    post: async (url, body) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.status === 401) {
            return handleRetryWithRefresh('POST', url, body, false);
        }
        if (!res.ok) {
            const err = new Error(data.message || 'Request failed');
            err.status = res.status;
            throw err;
        }
        return data;
    },
    postForm: async (url, formData) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        const data = await res.json();
        if (res.status === 401) {
            return handleRetryWithRefresh('POST', url, formData, true);
        }
        if (!res.ok) {
            const err = new Error(data.message || 'Request failed');
            err.status = res.status;
            throw err;
        }
        return data;
    },
    put: async (url, body) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.status === 401) {
            return handleRetryWithRefresh('PUT', url, body, false);
        }
        if (!res.ok) {
            const err = new Error(data.message || 'Request failed');
            err.status = res.status;
            throw err;
        }
        return data;
    }
};

export const toAbsoluteUrl = (maybeRelativeUrl) => {
    const value = String(maybeRelativeUrl || '');
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};
