import axios from 'src/api/axios';
import ENV from 'src/env';
import { getMe } from 'src/services/queries/user';
import { CurrentAPIUserDto } from '@api/types/User.dto';

let userCache: CurrentAPIUserDto | null = null;
let isFetchingUser = false;
let userFetchPromise: Promise<CurrentAPIUserDto | null> | null = null;

export const getUser = async (): Promise<CurrentAPIUserDto> => {
    if (userCache !== null) {
        return userCache;
    }
    if (isFetchingUser) {
        return (
            (await userFetchPromise) ??
            (await Promise.reject(new Error('Failed to fetch user')))
        );
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

    return (
        (await userFetchPromise) ??
        (await Promise.reject(new Error('Failed to fetch user')))
    );
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

export const login = (): void => {
    globalThis.location.href = `${ENV.ENDPOINT}/auth/google`;
};
