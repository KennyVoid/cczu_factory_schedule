/**
 * APS 排产演示系统 - API 客户端
 */
const API = (() => {
    const BASE = '';

    async function request(method, path, data, isForm) {
        const opts = {
            method,
            headers: {},
        };

        if (method === 'GET') {
            // Do nothing special for GET
        } else if (data instanceof FormData || isForm) {
            opts.body = data instanceof FormData ? data : toFormData(data);
        } else if (data) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data);
        }

        // Append query params for GET
        let url = `${BASE}${path}`;
        if (method === 'GET' && data) {
            const params = new URLSearchParams();
            Object.entries(data).forEach(([k, v]) => {
                if (v !== undefined && v !== null) params.append(k, v);
            });
            const qs = params.toString();
            if (qs) url += `?${qs}`;
        }

        const res = await fetch(url, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `请求失败 (${res.status})`);
        }
        return res.json();
    }

    function toFormData(obj) {
        const fd = new FormData();
        Object.entries(obj).forEach(([k, v]) => {
            if (v !== undefined && v !== null) fd.append(k, v);
        });
        return fd;
    }

    // ===== Schedule APIs =====
    const schedule = {
        optimize(orderIds) {
            return request('POST', '/api/schedule/optimize',
                orderIds ? { order_ids: orderIds.join(',') } : {});
        },
        getResult(id) {
            return request('GET', `/api/schedule/result/${id}`);
        },
        listResults() {
            return request('GET', '/api/schedule/results');
        },
        exportResult(id) {
            return `${BASE}/api/schedule/export/${id}`;
        },
        getGanttData(id) {
            return request('GET', `/api/schedule/gantt-data/${id}`);
        },
    };

    // ===== Order APIs =====
    const orders = {
        list(params) {
            return request('GET', '/api/orders', params);
        },
        get(id) {
            return request('GET', `/api/orders/${id}`);
        },
        create(data) {
            return request('POST', '/api/orders', data);
        },
        setPriority(id, priority) {
            return request('PUT', `/api/orders/${id}/priority`, { priority });
        },
        importFile(file) {
            const fd = new FormData();
            fd.append('file', file);
            return request('POST', '/api/orders/import', fd, true);
        },
    };

    // ===== Constraints =====
    const constraints = {
        list() {
            return request('GET', '/api/constraints');
        },
        update(data) {
            return request('PUT', '/api/constraints', data);
        },
    };

    // ===== Products =====
    const products = {
        list() {
            return request('GET', '/api/products');
        },
    };

    // ===== Dashboard / Mock Data =====
    const dashboard = {
        employees() { return request('GET', '/api/dashboard/employees'); },
        equipment() { return request('GET', '/api/dashboard/equipment'); },
        materials() { return request('GET', '/api/dashboard/materials'); },
        mesLines() { return request('GET', '/api/dashboard/mes-lines'); },
        quality() { return request('GET', '/api/dashboard/quality'); },
        safety() { return request('GET', '/api/dashboard/safety'); },
        anomaly() { return request('GET', '/api/dashboard/anomaly'); },
        mockChart() { return request('GET', '/api/dashboard/mock-chart'); },
        scheduleStats() { return request('GET', '/api/dashboard/schedule-stats'); },
    };

    // ===== Employees =====
    const employees = {
        list() { return request('GET', '/api/employees'); },
        get(id) { return request('GET', `/api/employees/${id}`); },
        create(data) { return request('POST', '/api/employees', data); },
        update(id, data) { return request('PUT', `/api/employees/${id}`, data); },
        remove(id) { return request('DELETE', `/api/employees/${id}`); },
    };

    return { request, schedule, orders, constraints, products, dashboard, employees };
})();
