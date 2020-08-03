import React, { useState, useEffect, useRef } from 'react';

import {
    Spin,
    Select,
    Divider,
    Pagination
} from 'antd';

import { isEqual } from 'lodash';

import { debounce } from 'lodash';

import api from 'utils/api';

const { Option } = Select;

const fetch = (url, params = {}) => {
    const options = { params }

    if (options.params.filters !== undefined) {
        options.params.filters = JSON.stringify(options.params.filters);
    }

    if (options.params.fields !== undefined) {
        options.params.fields = JSON.stringify(options.params.fields);
    }

    if (options.params.search !== undefined) {
        options.params.search = JSON.stringify(options.params.search);
    }

    return api.get(url, options).then(res => {
        const {data:items = [], total = 0, pages = 0, page = 0 } = res;
        return {items, total, pages, page};
    });
};

const Masking = () => (
    <div style={{textAlign: 'center', paddingTop: '16px'}}>
        <Spin size="small" />
    </div>
);

const KctSelect = React.forwardRef((props, ref) => {
    
    const {
        url,
        children,
        onChange, 
        onSelectModel,
        onChangeModel,
        defaultValue,
        value = defaultValue,
        defaultParams: {
            start: defaultStart = 0,
            limit: defaultLimit = 10, 
            ...restDefaultParams
        } = {},
        itemLabelPath = 'label',
        itemValuePath = 'value',
        itemQueryPath = itemLabelPath,
        itemRenderer,
        ...attrs
    } = props;
    
    const initialPaging = {
        start: defaultStart,
        limit: defaultLimit,
        total: 0,
        pages: 0,
        page: 0
    };

    const [searching, setSearching] = useState(false);
    const [pristine, setPristine] = useState(true);
    const [booting, setBooting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState(null);

    const [remoteStore, setRemoteStore] = useState({
        items: [],
        paging: {...initialPaging}
    });

    const [runtimeStore, setRuntimeStore] = useState({
        items: [],
        paging: {...initialPaging}
    });

    const [store, setStore] = useState({
        items: [],
        paging: {...initialPaging}
    });

    const lastParams = useRef();

    useEffect(() => {
        let mounted = true;
        setBooting(true)

        if (url) {
            if (pristine) {
                if (value) {
                    const params = store.paging.limit !== 'all'
                        ? {
                            filters: [
                                { field: itemValuePath, value: Array.isArray(value) ? value : [value] , op: 'in' }
                            ],
                            start: store.paging.start,
                            limit: store.paging.limit    
                        } 
                        : {};

                    fetch(url, params).then(res => {
                        const { items, total, pages, page } = res;
                        const paging = { ...store.paging, total, pages, page }
                        
                        if (mounted) {
                            setStore({ items, paging });
                            setBooting(false);
                        }
                        
                        // if (onSelectModel) {
                        //     const model = items.find(e => e[itemQueryPath] === value);
                        //     if (model) {
                        //         onSelectModel(model);
                        //     }
                        // }
                    }).catch( _ => {
                        setBooting(false);
                    })
                } else {
                    setBooting(false);
                }
            } else {
                setBooting(false);
            }
        } else {
            setBooting(false);
        }

        return () => {
            mounted = false;
        }
    }, [value, pristine]);

    useEffect(() => {
        if (url) {
            setPristine(true)
        }
    }, [url]);

    // TODO: monitor this feature please...
    useEffect(() => {
        const equal = isEqual(restDefaultParams, lastParams.current);
        if ( ! equal) {
            setPristine(true);
        }
    }, [restDefaultParams]);

    useEffect(() => {
        lastParams.current = restDefaultParams;
    });
    
    const handleSearch = debounce(search => {
        if ( ! url || runtimeStore.paging.limit === 'all') {
            return;
        }

        setSearching(true);
        setSearch(search);

        const start = 0;
        const limit = runtimeStore.paging.limit;
        
        const params = {
            ...restDefaultParams,
            start,
            limit
        }

        if (search) {
            params['fields'] = [itemQueryPath];
            params['search'] = [search];
        }

        setLoading(true);

        fetch(url, params).then(res => {
            const { items, total, pages, page } = res;
            const paging = { ...runtimeStore.paging, start, total, pages, page }

            setRuntimeStore({ items, paging });
            setStore({ items, paging });
            
            setLoading(false);
        });

    }, 500);

    const handleChange = (value, option) => {
        if (value === undefined) {
            setPristine(true);
        }

        if (onChange) {
            onChange(value);
        }

        if (onChangeModel) {
            if (option) {
                const model = Array.isArray(option) 
                    ? option.map(o => o.props.model) 
                    : option.props.model
                onChangeModel(model)    
            } else {
                onChangeModel(option);
            }
        }
    };

    const handleSelect = (value, option) => {
        if (onSelectModel) {
            onSelectModel(option.props.model);
        }
    };

    const handlePopup = open => {
        if ( ! url) {
            return;
        }

        if (open) {
            
            if (pristine) {
                setPristine(false);
                
                const params = {
                    ...restDefaultParams,
                    start: remoteStore.paging.start,
                    limit: remoteStore.paging.limit
                }

                setLoading(true);

                fetch(url, params).then(res => {
                    const { items, total, pages, page } = res;
                    const paging = { ...remoteStore.paging, total, pages, page };

                    setRemoteStore({ items, paging });
                    setStore({ items, paging });

                    setLoading(false);
                });

            } else {
                const { items, paging } = remoteStore;
                setStore({ items, paging });
            }
        } else {
            if (searching) {
                setPristine(true)
            }
            setSearching(false);
        }
    };

    const handlePagination = (page, pageSize) => {
        const start = page * pageSize - pageSize;
        const limit = pageSize;

        const params = {
            ...restDefaultParams,
            start,
            limit
        };

        if (searching) {
            if (search) {
                params['fields'] = [itemQueryPath];
                params['search'] = [search];
            }
        }
        
        setLoading(true);

        fetch(url, params).then(res => {
            const { items, total, pages, page } = res;
            
            let paging = { start, limit, total, pages, page };
            
            if (searching) {
                paging = { ...runtimeStore.paging, ...paging };
                setRuntimeStore({ items, paging });
            } else {
                paging = { ...remoteStore.paging, ...paging };
                setRemoteStore({ items, paging });
            }

            setStore({ items, paging });
            setLoading(false);
        })
    };

    const options = url ? store.items.map(e => {
        const content = itemRenderer ? itemRenderer(e) : e[itemLabelPath];
        return <Option 
                    key={e[itemValuePath]} 
                    value={e[itemValuePath]} 
                    label={e[itemLabelPath]} 
                    model={{...e}}>{content}</Option>
    }) : (children || []).map(c => {
        const attrs = {}
        const { children, ...model } = c.props;

        if (c.props.model !== undefined) {
            attrs.model = c.props.model;
        } else {
            attrs.model = model;
        }

        if (c.props.label === undefined) {
            attrs.label = children;
        }

        return React.cloneElement(c, { ...attrs });
    });
    
    let remoteSearch = true;

    if (url) {
        if (store.paging.limit === 'all') {
            remoteSearch = false;
        }
    } else {
        remoteSearch = false;
    }

    const customFilterOption = remoteSearch ? false : (input, option) => {
        return option.props.children.toLowerCase().includes(input.toLowerCase());
    };

    const customOptionFilterProp = remoteSearch ? 'value' : 'children';

    if (booting) {
        return (
            <Select key="fake" ref={ref} {...attrs} loading />
        );
    }
    
    const valueAttr = defaultValue === undefined 
        ? onChange === undefined 
            ? { defaultValue: value }
            : { value }
        : { defaultValue: value };

    return (
        <Select 
            ref={ref} 
            key="orig"
            showSearch 
            allowClear 
            {...attrs}  
            {...valueAttr}   
            filterOption={customFilterOption} 
            optionFilterProp={customOptionFilterProp} 
            defaultActiveFirstOption={false}  
            notFoundContent={loading ? <Masking /> : null} 
            onSearch={handleSearch} 
            onChange={handleChange} 
            onSelect={handleSelect} 
            onDropdownVisibleChange={handlePopup} 
            dropdownRender={menu=>(
                <div>
                    { loading ? <Masking /> : menu }
                    <div hidden={ store.paging.pages < 2 }>
                        <Divider style={{ margin: '4px 0' }} />
                        <div style={{textAlign: 'center', padding: '2px'}} onMouseDown={e => e.preventDefault()}>
                        {
                            store.paging.limit !== 'all' 
                            ? (
                                <Pagination 
                                    onChange={handlePagination} 
                                    size="small" 
                                    current={store.paging.page} 
                                    pageSize={store.paging.limit} 
                                    total={store.paging.total} />
                            ) : null
                        }
                        </div>
                    </div>
                </div>
            )}>
            { options }
        </Select>
    );
});

KctSelect.name = KctSelect.displayName = 'KctSelect';
KctSelect.Option = Option;

export default KctSelect;