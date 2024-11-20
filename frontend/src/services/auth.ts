import axios from 'src/api/axios';
import ENV from 'src/env';
import { getMe } from 'src/services/queries/user';
import { User } from 'src/types/User';
import { CurrentAPIUserDto } from '@api/types/User.dto';

let userCache: User | null = null;
let isFetchingUser = false;
let userFetchPromise: Promise<User | null> | null = null;

export const getUser = (): Promise<CurrentAPIUserDto | null> => {
    if (userCache !== null) {
        return Promise.resolve(userCache);
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

export const isAuthenticated = async () => {
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
                window.location.reload();
            })
            .catch(() => reject(false));
    });
}

export const login = () => {
    window.location.href = `${ENV.ENDPOINT}/auth/google`;
};
