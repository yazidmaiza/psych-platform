const BASE_URL = 'http://localhost:5000';

const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
});

export const api = {
    get: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request failed');
        return data;
    },
    post: async (url, body) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request failed');
        return data;
    },
    put: async (url, body) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request failed');
        return data;
    }
};