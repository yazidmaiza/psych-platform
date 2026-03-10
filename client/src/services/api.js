const BASE_URL = 'http://localhost:5000';

const getHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
});

export const api = {
    get: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, { headers: getHeaders() });
        return res.json();
    },
    post: async (url, body) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        return res.json();
    },
    put: async (url, body) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        return res.json();
    }
};