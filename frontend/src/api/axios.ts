import axios, { RawAxiosResponseHeaders } from 'axios';
import ENV from 'src/env';
import { ref } from 'vue';
import { parseISO } from 'date-fns';

const isoDateRegex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d*)?(?:[-+]\d{2}:?\d{2}|Z)?$/;

const isIsoDateString = (value: unknown): value is string => {
    return typeof value === 'string' && isoDateRegex.test(value);
};

const handleDates = (data: unknown) => {
    if (isIsoDateString(data)) return parseISO(data);
    if (data === null || data === undefined || typeof data !== 'object')
        return data;

    for (const [key, val] of Object.entries(data)) {
        // @ts-expect-error this is a hack to make the type checker happy
        if (isIsoDateString(val)) data[key] = parseISO(val);
        else if (typeof val === 'object') handleDates(val);
    }

    return data;
};

const axiosInstance = axios.create({
    baseURL: ENV.ENDPOINT,
    withCredentials: true,
    timeout: 1000 * 60 * 30,
    // Add more settings as needed
});

export const kleinkramVersion = ref('0.0.0');
const validVersion = /^\d+\.\d+\.\d+$/;

axiosInstance.interceptors.response.use(
    (response) => {
        const headers = response.headers;
        setVersion(headers);
        handleDates(response.data);
        return response;
    },
    async (error: any) => {
        const originalRequest = error.config;

        if (error.response) {
            const headers = error.response.headers;
            setVersion(headers);
        }

        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            await axios.post(
                `${ENV.ENDPOINT}/auth/refresh-token`,
                {},
                { withCredentials: true },
            );
            return axios(originalRequest);
        }

        return Promise.reject(error as Error);
    },
);

function setVersion(headers: RawAxiosResponseHeaders) {
    if (
        headers['kleinkram-version'] &&
        validVersion.test(kleinkramVersion.value) &&
        kleinkramVersion.value !== headers['kleinkram-version']
    ) {
        kleinkramVersion.value = headers['kleinkram-version'] as string;
    }
}

export default axiosInstance;
