import { CurrentAPIUserDto } from '@api/types/user.dto';
import axios from 'src/api/axios';
import { getMe } from 'src/services/queries/user';
import ENV from '../environment';

let userCache: CurrentAPIUserDto | null = null;
let isFetchingUser = false;
let userFetchPromise: Promise<CurrentAPIUserDto | null> | null = null;

export const getUser = async (): Promise<CurrentAPIUserDto | null> => {
    if (userCache !== null) {
        return userCache;
    }
    if (isFetchingUser) {
        return userFetchPromise;
    }
    isFetchingUser = true;
    userFetchPromise = getMe()
        .then((userData) => {
            userCache = userData;
            isFetchingUser = false;
            return userData;
        })
        .catch(() => {
            isFetchingUser = false;
            return null;
        });

    return userFetchPromise;
};

export const isAuthenticated = async (): Promise<boolean> => {
    const user = await getUser();
    return user !== null;
};

export function logout() {
    userCache = null;
    isFetchingUser = false;
    userFetchPromise = null;
    return new Promise((resolve, reject) => {
        axios
            .post('/auth/logout')
            .then(() => {
                // reload the page to clear the cache
                globalThis.location.reload();
            })
            .catch(() => {
                reject(new Error('Failed to logout'));
            });
    });
}

export const login = (provider: string): void => {
    globalThis.location.href = `${ENV.ENDPOINT}/auth/${provider}`;
};
