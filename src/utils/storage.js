import { NAV_STYLE } from 'modules/app/constants';

import { 
    SIGNIN_USER_SUCCESS, 
    SIGNOUT_USER_SUCCESS
    // , LOAD_MENUS_SUCCESS 
    // , LOAD_ACCESSES_SUCCESS 
} from 'modules/auth/types';

import { appName } from './config';

export const load = key => {
    const name = `${appName}:${key}`;

    try {
        const text = localStorage.getItem(name);
        if (text === null) {
            return {};
        }
        return JSON.parse(text);
    } catch(err) {
        return {};
    }

};

export const save = (key, json) => {
    const name = `${appName}:${key}`;

    try {
        const text = JSON.stringify(json);
        localStorage.setItem(name, text);   
    } catch(err){}
};

export const clear = (key) => {
    save(key, {});
};

export const storageMiddleware = ({ getState }) => {
    return next => action => {
        const result = next(action);

        if (action.type === NAV_STYLE) {
            const { settings = {} } = getState();
            save('settings', settings);
        } else if ([SIGNIN_USER_SUCCESS, SIGNOUT_USER_SUCCESS].includes(action.type)) {
            const { session = {} } = getState();
            save('session', session);
        }

        return result;
    }
};