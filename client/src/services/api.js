const RAW_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
export const BASE_URL = RAW_API_URL.replace(/\/api\/?$/, '');

const getHeaders = () => ({
    ...(localStorage.getItem('token')
        ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        : {}),
    'Content-Type': 'application/json'
});

const getAuthHeaders = () => ({
    ...(localStorage.getItem('token')
        ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        : {})
});

const getPublicHeaders = () => ({
    'Content-Type': 'application/json'
});

const parseResponseBody = async (res) => {
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (isJson) {
        try {
            return await res.json();
        } catch {
            // fall through to text for better error messages
        }
    }

    const text = await res.text();
    return { __nonJson: true, text, contentType };
};

const toErrorFromResponse = (data, res) => {
    if (data && !data.__nonJson) {
        return data?.message || 'Request failed';
    }

    const preview = String(data?.text || '').slice(0, 120).replace(/\s+/g, ' ').trim();
    const type = data?.contentType ? ` (${data.contentType})` : '';
    return `Request failed${type}. Status ${res.status}. Response: ${preview || '[empty]'}`;
};

export const api = {
    get: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, { headers: getHeaders() });
        const data = await parseResponseBody(res);
        if (!res.ok) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        if (data && data.__nonJson) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        return data;
    },
    getPublic: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, { headers: getPublicHeaders() });
        const data = await parseResponseBody(res);
        if (!res.ok) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        if (data && data.__nonJson) {
            const err = new Error(toErrorFromResponse(data, res));
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
        const data = await parseResponseBody(res);
        if (!res.ok) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        if (data && data.__nonJson) {
            const err = new Error(toErrorFromResponse(data, res));
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
        const data = await parseResponseBody(res);
        if (!res.ok) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        if (data && data.__nonJson) {
            const err = new Error(toErrorFromResponse(data, res));
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
        const data = await parseResponseBody(res);
        if (!res.ok) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        if (data && data.__nonJson) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        return data;
    },
    del: async (url) => {
        const res = await fetch(`${BASE_URL}${url}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await parseResponseBody(res);
        if (!res.ok) {
            const err = new Error(toErrorFromResponse(data, res));
            err.status = res.status;
            throw err;
        }
        if (data && data.__nonJson) {
            const err = new Error(toErrorFromResponse(data, res));
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

export default api;
