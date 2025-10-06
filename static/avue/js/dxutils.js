var appAuth = 'oauth';

function getCookie(name) {
    var strcookie = document.cookie; //获取cookie字符串
    var arrcookie = strcookie.split('; '); //分割
    //遍历匹配
    for (var i = 0; i < arrcookie.length; i++) {
        var arr = arrcookie[i].split('=');
        if (arr[0] == name) {
            return arr[1];
        }
    }
    return '';
}

function getDXToken() {
    //var params = getUrlParams(window.location.href);
    //mytoken = getQueryString("token"); //params['token'];
    mytoken = getQueryString('token');

    if (mytoken === undefined || mytoken == null) {
        //mytoken = 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNTcxMDQ5Nzk5LCJqdGkiOiIxODQyMTJhMzI0YTU0NmQ5YWZkODgzOTg0M2FkZWQxYiIsInVzZXJfaWQiOjZ9.SQUZmz046YQ3alzFZnU-lVa1PwiZOTpepRYcwyxt6S4';
        if (appAuth === 'oauth') {
            mytoken = window.localStorage.getItem('access') || getCookie('access');
            window.localStorage.setItem('access', mytoken);
            window.localStorage.setItem('refresh', getCookie('refresh'));
        } else {
            mytoken = window.localStorage.getItem('access');
        }
    }
    if (mytoken === undefined || mytoken == null || mytoken == '') {
        //alert('找不到token，请重新登录');
        return '';
    } else {
        var a = mytoken.split(' ');
        if (a.length > 1) mytoken = a[1];
        window.localStorage.setItem('access', mytoken);
    }
    //console.log(mytoken);
    return 'Bearer ' + mytoken;
}
const apiurl = '/api/custom_bigscreen/';
const apiBusComUrl = '/api/custom_bigscreen_bus_com/'; // 业务组件url

async function getUserInfo() {
    url = '/userinfo/';
    const res = await apiquery('get', url);
    //console.log(res.username);
    return res.username;
}

// function uploadImg(data) {
//     url = '/api/uploads'
//     const res = apiquery('post', url, data)
//     return res;
// }

function loadInitData() {
    url = apiurl;
    param = {};
    res = apiquery('get', url);
    //console.log(res);
    //alert(res);
}

function newTemplate(tmpData) {
    url = apiurl;
    param = {};
    //console.log(tmpData);
    res = apiquery('post', url, param, tmpData);
    return res;
}

function getTemplate(id) {
    url = apiurl + id + '/';
    param = {};
    res = apiquery('get', url);
    return res;
}

function deleteTemplate(id) {
    url = apiurl + id + '/';
    param = {};
    res = apiquery('delete', url);
    return res;
}

function saveTemplate(id, tmpData) {
    url = apiurl + id + '/';
    param = {};

    res = apiquery('put', url, param, tmpData);
    return res;
}

// 业务组件相关
function newBusCom(tmpData) {
    url = apiBusComUrl;
    param = {};
    //console.log(tmpData);
    res = apiquery('post', url, param, tmpData);
    return res;
}

function getBusCom(id) {
    url = apiBusComUrl + id + '/';
    param = {};
    res = apiquery('get', url);
    return res;
}

function deleteBusCom(id) {
    url = apiBusComUrl + id + '/';
    param = {};
    res = apiquery('delete', url);
    return res;
}

function saveBusCom(id, tmpData) {
    url = apiBusComUrl + id + '/';
    param = {};

    res = apiquery('put', url, param, tmpData);
    return res;
}

async function apiquery(method, url, param, data) {
    try {
        let response;
        await axios({
            url: url,
            params: param,
            method: method,
            data: data,
            headers: {
                Authorization: getDXToken()
            },
            responseType: 'json'
        }).then(res => {
            response = res.data;
            //console.log(response);
        });
        return response;
    } catch (err) {
        if (err.response.status === 401) {
            const res = RefreshToken(async () => {
                const res2 = await apiquery(method, url, param, data);
                return res2;
            });
            return res;
        } else {
            if (err.response.data.detail) {
                console.log(err.response.data.detail);
                //this.$message.error(err.response.data.detail);
            } else {
                console.log(err.response.statusText);
                //message.error(err.response.statusText);
            }
        }

        return {
            error: true,
            message: err.response.data.detail
        };
    }
}

const RefreshToken = async callback => {
    try {
        //alert(window.localStorage.getItem('refresh'));
        const response = await axios.post('/token/refresh/', {
            refresh: window.localStorage.getItem('refresh')
        });
        //setToken("refresh", response.data.access);
        window.localStorage.setItem('access', response.data.access);
        const result = await callback();
        return result;
    } catch (err) {
        // if (err.response.data.detail) {
        //     message.error(err.response.data.detail);
        // } else {
        //     message.error(err.response.statusText);
        // }
        console.log(err);
        setTimeout(() => {
            // window.location = `${onlineURL}/wx`;
            alert('登录超时，请重新登录');
            //window.close();
        }, 500);
        return {
            error: true,
            message: err.response.data.detail
        };
    }
};

// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
// 例子：
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
Date.prototype.Format = function (fmt) {
    var o = {
        'M+': this.getMonth() + 1, //月份
        'd+': this.getDate(), //日
        'H+': this.getHours(), //小时
        'm+': this.getMinutes(), //分
        's+': this.getSeconds(), //秒
        'q+': Math.floor((this.getMonth() + 3) / 3), //季度
        S: this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp('(' + k + ')').test(fmt))
            fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length));
    return fmt;
};
