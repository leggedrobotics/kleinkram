import axios, { RawAxiosResponseHeaders } from 'axios';
import ENV from 'src/env';
import env from 'src/env';
import { ref } from 'vue';

const axiosInstance = axios.create({
    baseURL: ENV.ENDPOINT,
    withCredentials: true,
    // Add more settings as needed
});

export const kleinkramVersion = ref('0.0.0');
const validVersion = /^\d+\.\d+\.\d+$/;

axiosInstance.interceptors.response.use(
    (response) => {
        const headers = response.headers;
        setVersion(headers);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response) {
            console.log('error:', error);
            const headers = error.response.headers;
            setVersion(headers);
        }

        if (error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            await axios.post(
                `${env.ENDPOINT}/auth/refresh-token`,
                {},
                { withCredentials: true },
            );
            return axios(originalRequest);
        }

        return Promise.reject(error);
    },
);

function setVersion(headers: RawAxiosResponseHeaders) {
    console.log('KKV', headers['kleinkram-version']);
    if (
        headers['kleinkram-version'] &&
        validVersion.test(kleinkramVersion.value) &&
        kleinkramVersion.value !== headers['kleinkram-version']
    ) {
        console.log('updating version');
        kleinkramVersion.value = headers['kleinkram-version'];
    }
}

export default axiosInstance;
