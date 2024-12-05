import axios, { AxiosRequestConfig, RawAxiosResponseHeaders } from 'axios';
import ENV from 'src/env';
import { ref } from 'vue';
import { parseISO } from 'date-fns';

const isoDateRegex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d*)?(?:[-+]\d{2}:?\d{2}|Z)?$/;

const isIsoDateString = (value: unknown): value is string => {
    return typeof value === 'string' && isoDateRegex.test(value);
};

/**
 * Recursively parse ISO strings to Date objects
 * while ignoring all other JSON fields.
 *
 * @param data any JSON object
 *
 */
// eslint-disable-next-line complexity
const handleDates = <T extends JSON | null | undefined>(data: T): T | Date => {
    if (isIsoDateString(data)) return parseISO(data);
    if (data === null || typeof data !== 'object') return data;

    for (const [key, value] of Object.entries(data)) {
        // @ts-expect-error this is a hack to make the type checker happy
        if (isIsoDateString(value)) data[key] = parseISO(value);
        else if (typeof value === 'object') handleDates(value);
    }

    return data;
};

const axiosInstance = axios.create({
    baseURL: ENV.ENDPOINT,
    withCredentials: true,
    timeout: 1000 * 60 * 30,
});

export const kleinkramVersion = ref('0.0.0');
const validVersion = /^\d+\.\d+\.\d+$/;

const setVersion = (headers: RawAxiosResponseHeaders): void => {
    if (
        headers['kleinkram-version'] !== undefined &&
        validVersion.test(kleinkramVersion.value) &&
        kleinkramVersion.value !== headers['kleinkram-version']
    ) {
        kleinkramVersion.value = headers['kleinkram-version'] as string;
    }
};

type OriginalRequest = AxiosRequestConfig & {
    isRetryWithRefreshedToken?: boolean;
};

type AxiosInterceptorParameters = Parameters<
    typeof axiosInstance.interceptors.response.use
>;

const refreshAccessTokenAndRetry: AxiosInterceptorParameters[1] =
    // eslint-disable-next-line complexity
    async (error) => {
        if (!axios.isAxiosError(error)) throw error as Error;

        const originalRequest: OriginalRequest | undefined = error.config;
        if (originalRequest === undefined) throw error as Error;

        // we set the version if the error is a response error
        if (error.response) {
            const headers = error.response.headers;
            setVersion(headers);
        }

        // if the error is not a 401 error, we throw it
        // as refreshing the token is not necessary
        if (error.response?.status !== 401) throw error as Error;

        // throw if the original request has already been retried
        if (originalRequest.isRetryWithRefreshedToken === true)
            throw error as Error;

        // we set the _retry property to true to avoid an infinite loop,
        // and we refresh the access token
        originalRequest.isRetryWithRefreshedToken = true;
        await axios.post(
            `${ENV.ENDPOINT}/auth/refresh-token`,
            {},
            { withCredentials: true },
        );

        // we retry the original request
        return axios(originalRequest);
    };

const parseResponse: AxiosInterceptorParameters[0] = (response) => {
    const headers = response.headers;
    setVersion(headers);
    handleDates(response.data);
    return response;
};

/*
 *
 * We augment the axios instance with an interceptor.
 * This interceptor will refresh the access token if it is expired.
 *
 * The interceptor will also parse the response and convert all ISO strings
 * to Date objects ensuring that the frontend always works with Date objects.
 *
 */
axiosInstance.interceptors.response.use(
    parseResponse,
    refreshAccessTokenAndRetry,
);

export default axiosInstance;
