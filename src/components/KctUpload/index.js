import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Upload, notification } from 'antd';
import api from 'utils/api';

const MESSAGE_DURATION = 8;
const MIME_VALIDATOR = window['MIME_VALIDATOR'] || {};

const url2name = url => {
    if (url) {
        if (/^http/.test(url)) {
            try {
                const u = new URL(url);
                const n = u.pathname.split('/').pop()
                return n;
            } catch(e){}
        }
    }
    return url;
}

const KctUpload = React.forwardRef((props, ref) => {

    const component = useRef();
    
    const {accessToken} = useSelector(({ session }) => session);
    
    const [files, setFiles] = useState([]);

    const { 
        children, 
        url, 
        value, 
        fileItem = {},
        mimeValidator,
        headers = {},
        allowedTypes,
        onChange = () => {},
        onFileChange,
        ...attrs 
    } = props;

    let mimes;

    if (mimeValidator !== undefined) {
        mimes = MIME_VALIDATOR[mimeValidator] || []
    } else {
        mimes = allowedTypes || []; 
    }

    useEffect(() => {
        if (ref) {
            if (typeof ref === 'function') {
                ref(component.current);
            } else {
                ref.current = component.current;
            }
        }
    });

    const { name: fileItemName } = fileItem;

    const renderFileItem = () => {
        const { 
            name, 
            uid = name,
            status = 'done', 
            ...attrs 
        } = fileItem;
        
        if (name) {
            const fixedName = url2name(name);

            const file = {
                uid, 
                name: fixedName,
                status,
                ...attrs
            } 
            
            setFiles([file]);
        }
    };

    useEffect(() => {
        if (fileItemName) {
            renderFileItem();
        }
    }, [fileItemName]);

    useEffect(() => {
        let reset = false;
        const { name } = fileItem;

        if (url) {
            if (name === value) {
                reset = true;
            }
        } else {
            if (value === undefined) {
                reset = true;
            }
        }

        if (reset) {
            renderFileItem();
        }

    }, [value]);

    const validateType = file => {
        const { type, name } = file;
        if (mimes.length && !mimes.includes(type)) {
            notification.error({
                duration: MESSAGE_DURATION,
                message: 'Invalid File Type',
                description: (
                    <span>
                        The specified file "<b>{name}</b>" could not be uploaded. 
                        File is invalid, or not supported. Allowed types:
                        <ul>{mimes.map((m, k) => <li key={k}>{m}</li>)}</ul>
                    </span>
                )
            });

            return false;
        }
        return true;
    };    

    const upload = { ...attrs };

    if (mimes.length) {
        upload.accept = mimes.join(',');
    }

    if (url === undefined) {
        upload.onRemove = file => {
            setFiles(old => {
                const items = [...old];
                const index = items.findIndex(f => f.uid === file.uid);
                items.splice(index, 1);
                return items;
            });

            onChange('');
        };

        upload.beforeUpload = file => {
            const valid = validateType(file);

            if (valid) {
                setFiles(old => {
                    const items = [file];
                    return items;
                });

                onChange(file);
            }

            
            return false;
        };
    } else {
        upload.action = api.defaults.baseURL + url;
        
        upload.headers = {
            ...headers,
            authorization: 'Token ' + accessToken
        };

        upload.beforeUpload = file => {
            const valid = validateType(file);

            if ( ! valid) {
                return false;
            }

            return true;
        };

        upload.onChange = e => {

            const { file/*, fileList*/ } = e;
            const { status } = file;
            
            if (status !== undefined) {
                switch(status) {
                    case 'done': {
                        const { response: { 
                            data: {
                                // guid,
                                file: name,
                                url
                            } 
                        }} = file;
                        const fixedName = url2name(name);
                        const filecopy = {...file, name: fixedName, url};
                        setFiles([filecopy]);
                        onChange(filecopy.name);
                        break;
                    }
                    case 'removed': {
                        setFiles([]);
                        onChange('');
                        break;
                    }
                    default:
                    case 'uploading': {
                        setFiles([file]);
                        onChange(file.name);
                    }
                }

            }

        }
    }

    useEffect(() => {
        const file = files.length ? files[0] : null;
        if (onFileChange) {
            onFileChange(file);
        }
    }, [files]);
    
    return (
        <Upload ref={component} {...upload} fileList={files}>{children}</Upload>
    );

});

export default KctUpload;