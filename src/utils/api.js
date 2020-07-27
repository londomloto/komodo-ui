import React from 'react';
import axios from 'axios';
import * as storage from 'utils/storage';
import * as Sentry from '@sentry/browser';
import { notification } from 'antd';

import { 
    apiBaseUrl,
    wafEnabled 
} from './config';

import history from './history';

const options = {
    authorization: null,
    session: null, 
};

const api = axios.create({
    baseURL: apiBaseUrl,
    headers: {
        'Content-Type': 'application/json'
    },
    /*
    transformResponse: [
        data => {
            let json;
            
            try {
                json = JSON.parse(data)
            } catch(error) {
                //throw Error(`[requestClient] Error parsing response JSON data - ${JSON.stringify(error)}`)
            }

            return json.data;

            // if (json.success) {
            //     return json.data;
            // } else {
            //     //throw Error(`[requestClient] Request failed with reason -  ${data}`)
            // }
        }
    ]*/
});

const handle401 = () => {
    storage.save('session', {});
    options.authorization = null;

    const { location: { pathname } } = history;

    if (pathname !== '/auth/login') {
        history.replace('/auth/login');
    }
}

api.defaults.xsrfCookieName = 'csrftoken';
api.defaults.xsrfHeaderName = 'X-CSRFToken';

api.interceptors.request.use(config => {
    const commonHeaders = {
        ...config.headers.common,
    };  

    if (!options.authorization) {
        const { accessToken: authorization } = storage.load('session');
        options.authorization = authorization;
    }

    if (options.authorization) {
        commonHeaders.Authorization = 'Token ' + options.authorization;
    }

    if (!options.session){
        const { session } = storage.load('settings');
        options.session = session;
    }

    if (options.session){
         commonHeaders['X-Session'] = options.session;
    }
    
    config.headers.common = commonHeaders;

    if (wafEnabled) {
        if (config.method === 'put') {
            config.method = 'post';
            config.url += '/edit';
        } else if (config.method === 'delete') {
            config.method = 'post';
            config.url += '/remove';
        } else if (config.method === 'patch') {
            config.method = 'post';
            config.url += '/partial_edit';
        }
    }

    return config;
});

api.interceptors.response.use(
    response => {
        if(response.data instanceof Blob){
            return response 
        }
        else{
            const { 
                status: responseStatus,
                data: { 
                    success, 
                    status, 
                    message = '', 
                    data = {}, 
                    count, 
                    total, 
                    page, 
                    pages 
                } 
            } = response;

            if ( ! success) {
                if (responseStatus === 204) {
                    // valid, do nothing
                } else {
                    if (message !== undefined) {
                        Sentry.captureException(message);
                        notification.error({
                            message: 'Error',
                            description: (
                                <React.Fragment>
                                    {message.split("\n").map((m,i)=>{
                                        return (<React.Fragment key={i}>
                                            {m}
                                            <br/>
                                        </React.Fragment>);
                                    })}
                                </React.Fragment>
                            ),
                        });
                    }

                    if (status === 401) {
                        handle401();
                    }

                }
            }

            response.message = message;
            response.success = success;
            response.statusCode = status !== undefined ? status : responseStatus;
            response.data = data;
            response.count = count;
            response.total = total;
            response.page = page;
            response.pages = pages;
        }

        return response;
    },
    error =>  {
        /*console.log(error.response)
        // console.log(error.response.data)
        // const storeStringify = JSON.stringify(error.response.config);
        const { user } = storage.load('session');
        const email = user.username;
        Sentry.configureScope(
            scope => scope
                .setLevel("Error")
                .setUser({ email })
        );*/
        // The request was made and the server responded with a status code
        if (error.response){
            switch (error.response.status) {
                case 401:
                    notification.error({
                        message: 'Error',
                        description: "Token expired !",
                    });

                    handle401();

                    break;
                
                case 403:
                    notification.error({
                        message: 'Forbidden !',
                        description: "You are not allowed to access this API !",
                    });
                    break;
            
                default:
                    Sentry.captureException(error);
                    notification.error({
                        message: 'Error',
                        description: "Application encountered an error. Don't worry, we've notified about this.",
                    });
                    break;
            }
        // The request was made but no response was received
        } else if(error.request){
            Sentry.captureException(error);
            notification.error({
                message: 'Server Error',
                description: "Application server encountered an error. Don't worry, we've notified about this.",
            });
        // Something happened in setting up the request that triggered an Error
        } else {
            Sentry.captureException(error);
            notification.error({
                message: 'Request Error',
                description: "Application encountered an error. Don't worry, we've notified about this.",
            });
        }
        
        return Promise.reject(error);
    }
);

api.configure = () => {
    const { accessToken: authorization } = storage.load('session');
    const { session } = storage.load('config');
    options.authorization = authorization;
    options.session = session;
};

api.download = (url,params) => {
    const download = api.post(url,params,{
      responseType: 'blob'
    }).then(res => {
        let filename = res['headers']['content-disposition'].split("filename=")[1]
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();  
    })

    return download
}

export default api;

const setup = (config) => {
    
};

export { setup };