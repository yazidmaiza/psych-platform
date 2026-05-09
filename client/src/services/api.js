export const BASE_URL = 'http://localhost:5000';

const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
});

const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const api = {
    get: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, { headers: getHeaders() });
        const data = await res.json();
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
