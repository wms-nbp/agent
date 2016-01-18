/********************************************************************
 * 측정 AGENT
 ********************************************************************
 * 설명
 *  - PhantomJS 기반의 CasperJS 를 사용함.
 *  - node.js 와의 연동을 위하여 Driver로 spooky를 활용.
 ********************************************************************/
var Spooky = require('spooky');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path-extra');
var LogPath = path.homedir() + '/WMS';
var createHAR = require('./createHAR');
var zlib = require('zlib');
var exec = require('child_process').exec;

function spooky(paramMap, ScriptID, Version, login, loc, db, callback) {
    paramMap = JSON.parse(paramMap);
    var setting = paramMap.setting;

    if (paramMap.device == "PC") {
        var userAgent = 'WMS/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/601.2.7 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.7';
        var width = 1024;
        var height = 768;
    } else if (paramMap.device == "MOBILE") {
        var userAgent = 'WMS/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X)';
        var width = 375;
        var height = 627;
    }

    var spooky = new Spooky({
            child: {
                'web-security': 'no',
                "ignore-ssl-errors": true,
                "ssl-protocol": "tlsv1"
            },
            casper: {
                pageSettings: {
                    userAgent: userAgent,
                    resourceTimeout: setting.resourceTimeout
                },
                logLevel: "error",
                timeout: setting.scriptRunTime,
                verbose: false,
                onTimeout: function() {},
                onError: function(msg, trace) {}
            }
        },
        function(err) {
            spooky.start();
            spooky.then([{
                    setting: setting,
                    loc: loc,
                    ScriptID: ScriptID,
                    Version: Version,
                    paramMap: paramMap,
                    db: db,
                    login: login,
                    width: width,
                    height: height,
                    LogPath: LogPath
                },
                function() {
                    var uuid = require('node-uuid');
                    var script = paramMap.script;
                    var scriptName = paramMap.name;
                    var filter = paramMap.filter;

                    var element = '';
                    var resources = [];
                    var resultMap = {};
                    resultMap.error = {};
                    var recentURL = script[0].url;
                    var reqList = [];
                    var startTime = '';
                    var endTime = '';
                    var uploadList = [];
                    var networkErr = [];
                    var javascriptErr = [];
                    var timeoutErr = [];
                    var actionErr = [];
                    var scriptStep = 0;
                    var year = '';
                    var mon = '';
                    var day = '';
                    var hour = '';
                    var min = '';
                    var path = '';
                    var har_path = '';
                    var javascriptErrCnt = 0;
                    var javascriptErrChk = 0;
                    
                    var resourceUUID     = uuid.v4();
                    var resourceErrCnt   = 0;
                    
                    var reqLogicCheck = false;
                    var javaLogicCheck = false;
                    
                    this.on('page.initialized', function() {
                        filter.javascript.push("ReferenceError: Can't find variable: Audio");
                        filter.javascript.push("TypeError: undefined is not an object (evaluating 'naver.main.rest.init')");
                        filter.javascript.push("TypeError: undefined is not an object (evaluating 'naver.main.FontSize.update')");

                        this.evaluate(function() {
                            window.navigator.appCodeName = 'Mozilla';
                            window.navigator.appName = 'Netscape';
                        });
                    });

                  //Request Error 발생시 호출
                    this.on('resource.error', function(resERR) {
                        var loadTime = (new Date()) - (new Date(resources[resERR.id].request.time));
                        var errTime = setting.resourceTimeout;
                        var file = path + "/" + resourceUUID + ".jpg";
                        var har_file = har_path + "/" + resourceUUID + ".har.gz";
                        /********************************************************************
                         * err type 정의
                         ********************************************************************
                         *[1]  설명   : 로딩된 시간이 사용자가 설정한 기준값을 초과한 경우
                         *     메세지 : 해당 요청이 임계치 기준 값을 초과 하였습니다.
                         *[2]  설명   : HTTP STATUS CODE 가 오류 코드인 경우 400~599    
                         *     메세지 : 데이터 로드 실패. [404] http://www.naver.com/icon.jpg
                         ********************************************************************/
                        if (resERR.errorCode == '5' && (loadTime <= errTime)) {
                            return true;
                        } else if (resERR.errorCode == '5' && (loadTime >= errTime)) {
                            var error = {
                                id: resourceUUID,
                                res_id: resERR.id,
                                msg: resERR.errorString + " (해당 요청이 임계치 기준 값을 초과 하였습니다.)\n" + "URL : " + resERR.url,
                                url: resERR.url,
                                load: loadTime,
                                code: 'null(cancel)',
                                type: 'network',
                                image: file,
                                har: har_file,
                                step: scriptStep,
                                time: (new Date()).getTime()
                            }
                            resourceErrCnt++;
                            if(resourceErrCnt > 1 && reqLogicCheck==true && (parseInt(error.time) - parseInt(networkErr[networkErr.length-1].time)) < 100){
                    			networkErr.push(error);
                                //console.log(JSON.stringify(error));
                            } else {
                            	reqLogicCheck = true;
                            	var localUUID = uuid.v4();
                            	resourceUUID = localUUID;                            	
                            	error.id = localUUID;
                            	error.image = path + "/" + localUUID + ".jpg";
                                error.har = har_path + "/" + localUUID + ".har.gz";
                            	networkErr.push(error);
                                //console.log(JSON.stringify(error));
                                this.waitFor(function() {
                                    this.emit('save.image', file, localUUID);
                                    return true;
                                });
                                this.waitFor(function() {
                                    this.emit('create.har', har_file, localUUID);
                                    return true;
                                });
                            }
                        } else {
                            var error = {
                            	id: resourceUUID,
                            	res_id: resERR.id,
                                msg: resERR.errorString,
                                url: resERR.url,
                                load: loadTime,
                                code: '',
                                type: 'network',
                                image: file,
                                har: har_file,
                                step: scriptStep,
                                time: (new Date()).getTime()
                            }
                            resourceErrCnt++;
                            if(resourceErrCnt > 1 && reqLogicCheck==true && (parseInt(error.time) - parseInt(networkErr[networkErr.length-1].time)) < 100){
                    			networkErr.push(error);
                                //console.log(JSON.stringify(error));
                            } else {
                            	reqLogicCheck = true;
                            	var localUUID = uuid.v4();
                            	resourceUUID = localUUID;
                            	error.id = localUUID;
                            	error.image = path + "/" + localUUID + ".jpg";
                                error.har = har_path + "/" + localUUID + ".har.gz";
                            	networkErr.push(error);
                                //console.log(JSON.stringify(error));
                                this.waitFor(function() {
                                    this.emit('save.image', file, localUUID);
                                    return true;
                                });
                                this.waitFor(function() {
                                    this.emit('create.har', har_file, localUUID);
                                    return true;
                                });
                            }
                        }
                    });

                    //Page 내에 Javascript 오류 발생시 호출
                    this.on('page.error', function(msg, trace) {
                        var count = 0;

                        if (javascriptErrCnt > 10 && javascriptErrChk == 0) {
                            this.waitFor(function() {
                                this.emit('complete');
                                return true;
                            });
                            javascriptErrChk++;
                        } else if (javascriptErrChk == 0) {
                            if (filter.javascript.length > 0) {
                                filter.javascript.forEach(function(pass) {
                                    pass = pass.replace("\\", "");
                                    if (msg.indexOf(pass) >= 0) {
                                        var log = {
                                            type: "filter",
                                            msg: msg
                                        };
                                        //console.log(JSON.stringify(log));
                                        count++;
                                    }
                                });
                                if (count == 0) {
                                    var error = {
                                        id: "",
                                        msg: msg,
                                        file: trace[0].file,
                                        line: trace[0].line,
                                        func: trace[0]['function'],
                                        image: "",
                                        type: 'javascript',
                                        har: "",
                                        step: scriptStep,
                                        time: (new Date()).getTime()
                                    };
                                    javascriptErrCnt++;
                                    if(javascriptErrCnt > 1 && javaLogicCheck == true && (parseInt(error.time) - parseInt(javascriptErr[javascriptErr.length-1].time)) < 100){
                                    	error.image = javascriptErr[javascriptErr.length-1].image;
                                    	error.har = javascriptErr[javascriptErr.length-1].har;
                                    	error.id = javascriptErr[javascriptErr.length-1].id;
                    					javascriptErr.push(error);
                                        //console.log(JSON.stringify(error));
                                    } else {
                                    	javaLogicCheck = true;
                                    	var localUUID = uuid.v4();
                                    	error.id = localUUID;
                                    	error.image = path + "/" + localUUID + ".jpg";
                                        error.har = har_path + "/" + localUUID + ".har.gz";
                                    	javascriptErr.push(error);

                                        //console.log(JSON.stringify(error));
                                    	this.waitFor(function() {
                                            this.emit('save.image', "", localUUID);
                                            return true;
                                        });
                                        this.waitFor(function() {
                                            this.emit('create.har', "", localUUID);
                                            return true;
                                        });
                                    }
                                }
                            } else {
                                this.waitFor(function() {
                                    var error = {
                                        id: "",
                                        msg: msg,
                                        file: trace[0].file,
                                        line: trace[0].line,
                                        func: trace[0]['function'],
                                        image: "",
                                        type: 'javascript',
                                        har: "",
                                        step: scriptStep,
                                        time: (new Date()).getTime()
                                    };

                                    javascriptErrCnt++;
                                    if(javascriptErrCnt > 1 && javaLogicCheck == true && (parseInt(error.time) - parseInt(javascriptErr[javascriptErr.length-1].time)) < 100){
                                    	error.image = javascriptErr[javascriptErr.length-1].image;
                                    	error.har = javascriptErr[javascriptErr.length-1].har;
                                    	error.id = javascriptErr[javascriptErr.length-1].id;
                    					javascriptErr.push(error);
                                        //console.log(JSON.stringify(error));
                                    } else {
                                    	javaLogicCheck = true;
                                    	var localUUID = uuid.v4();
                                    	error.id = localUUID;
                                    	error.image = path + "/" + localUUID + ".jpg";
                                        error.har = har_path + "/" + localUUID + ".har.gz";
                                    	javascriptErr.push(error);
                                        //console.log(JSON.stringify(error));
                                    	this.waitFor(function() {
                                            this.emit('save.image', "", localUUID);
                                            return true;
                                        });
                                        this.waitFor(function() {
                                            this.emit('create.har', "", localUUID);
                                            return true;
                                        });
                                    }
                                });
                            }
                        }
                    });

                    //사용자가 설정한 제한 시간내에 끝나지 않으면 호출
                    this.on("timeout", function() {
                        var uu_id = uuid.v4();
                        var file = path + "/" + uu_id + ".jpg";
                        var har_file = har_path + "/" + uu_id + ".har.gz";

                        this.waitFor(function() {
                            var error = {
                                id: uu_id,
                                msg: "스크립트 수행시간이 설정 기준값 보다 길어져 테스트가 중단 되었습니다." + " (기준값:" + setting.scriptRunTime + "ms)",
                                url: recentURL,
                                image: file,
                                type: 'timeout',
                                har: har_file,
                                step: scriptStep,
                                time: (new Date()).getTime()
                            }
                            timeoutErr[timeoutErr.length]=error;
                            //console.log(JSON.stringify(error));
                            if (endTime == '') {
                                endTime = new Date();
                            }
                            this.waitFor(function() {
                                this.emit('save.image', file, uu_id);
                                return true;
                            });
                            this.waitFor(function() {
                                this.emit('create.har', har_file, uu_id);
                                return true;
                            });
                            this.waitFor(function() {
                                this.emit('complete');
                                return true;
                            });
                        });
                    });



                        //처음 페이지가 열릴때 호출
                        this.on('load.started.custom', function() {
                            startTime = new Date();
                            year = startTime.getFullYear();
                            mon = startTime.getMonth() + 1;
                            mon = mon < 10 ? ("0" + mon) : mon;
                            day = startTime.getDate();
                            day = day < 10 ? ("0" + day) : day;
                            hour = startTime.getHours();
                            hour = hour < 10 ? ("0" + hour) : hour;
                            min = startTime.getMinutes();
                            min = min < 10 ? ("0" + min) : min;
                            path = "/image/" + loc + "/" + scriptName + "/" + year + "/" + mon + "/" + day + "/" + hour;
                            har_path = "/har/" + loc + "/" + scriptName + "/" + year + "/" + mon + "/" + day + "/" + hour;

                        });

                        //페이지 로딩이 완료 되었을때 호출 onLoad Time
                        this.on("load.finished.custom", function(status) {
                            endTime = new Date();
                        });


                        //테스트가 모두 완료 되었을때 호출
                        this.on('run.complete', function() {});


                        this.on('complete', function() {
                            this.emit('error.proc');
                            resultMap.status = 'success';
                            resultMap.loc = loc;
                            resultMap.script_id = ScriptID;
                            resultMap.script_ver = Version;
                            resultMap.time = startTime.getTime();
                            resultMap.loadtime = endTime - startTime;
                            resultMap.runtime = (new Date()) - startTime;
                            resultMap.request = resources.length;
                            resultMap.db = db;
                            resultMap.reqlist = reqList;
                            if (timeoutErr.length > 0 || actionErr.length > 0) {
                                resultMap.status = 'error';
                            }
                            if (javascriptErr.length > 0 || networkErr.length > 0) {
                                resultMap.status = 'error';
                            }
                            this.waitFor(function() {
                                for (var i = 0; i < networkErr.length; i++) {
                                    networkErr[i].code = resources[networkErr[i].res_id].endReply.status;
                                }
                                return true;
                            });
                            //console.log(JSON.stringify(log));
                            this.waitFor(function() {
                                this.emit('callback', resultMap, uploadList, ScriptID);
                                return true;
                            });                            
                            this.waitFor(function() {
                            	this.exit();
                                return true;
                            });
                        });

                        this.on('error.proc', function() {
                            if (javascriptErr.length > 0) {
                                resultMap.error.javascript = javascriptErr;
                            }
                            if (networkErr.length > 0) {
                                resultMap.error.network = networkErr;
                            }
                            if (timeoutErr.length > 0) {
                                resultMap.error.timeout = timeoutErr;
                            }
                            if (actionErr.length > 0) {
                                resultMap.error.action = actionErr;
                            }
                        });

                        //PhantomJS 에서 웹 페이지 로드시 출력되는 메세지 출력
                        this.on("remote.message", function(msg) {
                            //console.log("[Remote] " + msg);
                        });


                        this.on('resource.requested', function(req, request) {
                            var count = 0;
                            if (filter.url.length > 0) {
                                filter.url.forEach(function(pass) {
                                    if (req.url.indexOf(pass) > 0) {
                                        var log = {
                                            type: "filter",
                                            url: req.url
                                        };
                                        request.abort();
                                        count++;
                                    }
                                });
                                if (count == 0) {
                                    resources[req.id] = {
                                        request: req,
                                        startReply: null,
                                        endReply: null
                                    }
                                }
                            } else {
                                resources[req.id] = {
                                    request: req,
                                    startReply: null,
                                    endReply: null
                                }
                            }

                        });

                        this.on('resource.received', function(res) {
                            if (res.stage === 'start') {
                                resources[res.id].startReply = res;
                            }
                            if (res.stage === 'end') {
                                resources[res.id].endReply = res;
                                var log = {
                                    id: res.id,
                                    status: resources[res.id].endReply.status,
                                    type: "request",
                                    url: resources[res.id].endReply.url,
                                    time: (new Date(resources[res.id].endReply.time)) - (new Date(resources[res.id].request.time))
                                };
                                //console.log(JSON.stringify(log));
                            }
                        });


//                        this.on('console', function(line) {
//                            console.log(line);
//                        });

                        this.on('create.har', function(har_file, uu_id) {
                            var title = this.evaluate(function() {
                                return document.title;
                            });
                            var address = this.evaluate(function() {
                                return document.location.href
                            });
                            this.waitFor(function() {
                                if (title == '') {
                                    title = recentURL;
                                }
                                return true;
                            });                            
                            this.waitFor(function(){
                                uploadList.push({
                                    "filename" : uu_id + ".har.gz",
                                    "ori_path" : LogPath + "/temp/",
                                    "new_path" : har_path + "/"
                                });
                                this.emit('export.har', address, title, startTime, endTime, resources, har_file, uu_id);
                                return true;
                            });
                        });

                        this.on('save.image', function(file, uu_id) {
                            this.waitFor(function(){
                                this.evaluate(function(){
                                        document.body.bgColor = 'white';
                                });
                                try {
                                    this.capture(LogPath + "/temp/" + uu_id + ".jpg", undefined, {
                                        format : 'jpg',
                                        quality : 75
                                    });
                                    uploadList.push({
                                        "filename" : uu_id + ".jpg",
                                        "ori_path" : LogPath + "/temp/",
                                        "new_path" : path + "/"
                                    });
                                } catch (e) {
                                    //console.log(e);
                                }
                                return true;
                            });                 
                        });

                        this.on("url.changed", function(url) {
                            recentURL = url;
                            reqList.push(recentURL);
                            //client.set("url:"+ScriptID+":"+url.split("?")[0], ScriptID);
                        });

                        this.waitFor(function() {
                            this.emit('load.started.custom');
                            return true;
                        });

                        this.waitFor(function() {
                            if (typeof login.id != 'undefined') {
                                try {
                                    if (typeof login.custom != 'undefined' && login.custom != '') {
                                        var strLogin = login.custom;
                                        eval(JSON.parse(login.custom));
                                    } else {
                                        var login_info = {};
                                        var login_url = '';
                                        var login_path = '';
                                        for (key in login) {
                                            if (key == 'url') {
                                                login_url = login.url
                                            } else if (key == 'path') {
                                                login_path = login.path
                                            } else if (key == 'id') {
                                                login_info[login[key].split(",")[0]] = login[key].split(",")[1]
                                            } else if (key == 'pw') {
                                                login_info[login[key].split(",")[0]] = login[key].split(",")[1]
                                            }
                                        }
                                        this.waitFor(function() {
                                            this.thenOpen(login_url);
                                            return true;
                                        });
                                        this.waitFor(function() {
                                            this.fill(login_path, login_info, true);
                                            return true;
                                        });
                                        var log = {
                                            type: "login",
                                            msg: login["id"].split(",")[1]
                                        };
                                        //console.log(JSON.stringify(log));
                                    }
                                } catch (e) {
                                    var uu_id = uuid.v4();
                                    var file = path + "/" + uu_id + ".jpg";
                                    var har_file = har_path + "/" + uu_id + ".har.gz";
                                    var error = {
                                        id: uu_id,
                                        msg: "로그인에 실패 하였습니다. ",
                                        step: "999",
                                        time: (new Date()).getTime(),
                                        image: file,
                                        har: har_file,
                                        type: 'action'
                                    }
                                    actionErr[actionErr.length]=error;
                                    //console.log(JSON.stringify(error));
                                    this.waitFor(function() {
                                        this.emit('save.image', file, uu_id);
                                        return true;
                                    });
                                    this.waitFor(function() {
                                        this.emit('create.har', har_file, uu_id);
                                        return true;
                                    });
                                    this.waitFor(function() {
                                        this.emit('complete');
                                        return true;
                                    });
                                }
                            }
                            return true;
                        });

                        this.each(script, function(self, data, index) {
                            this.waitFor(function() {
                                scriptStep = index;
                                var uu_id = uuid.v4();
                                var file = path + "/" + uu_id + ".jpg";
                                var har_file = har_path + "/" + uu_id + ".har.gz";

                                if (typeof data.url != 'undefined') {
                                    this.waitFor(function() {
                                        this.viewport(width, height);
                                        return true;
                                    });
                                    this.waitFor(function() {
                                        this.emit('load.started.custom');
                                        return true;
                                    });
                                    this.waitFor(function() {
                                        this.thenOpen(data.url);
                                        return true;
                                    });
                                    this.waitFor(function() {
                                        this.emit('load.finished.custom');
                                        return true;
                                    });
                                    var log = {
                                        type: "info",
                                        msg: "URL OPEN : " + data.url
                                    };
                                    //console.log(JSON.stringify(log));
                                } else if (typeof data.find != 'undefined') {
                                    element = data.find;
                                    var log = {
                                        type: "info",
                                        msg: "FIND ELEMENT : " + element
                                    };
                                    //console.log(JSON.stringify(log));
                                    if (!this.exists(element)) {
                                        var error = {
                                            id: uu_id,
                                            msg: "ELEMENT IS NOT FOUND : " + element,
                                            step: scriptStep,
                                            time: (new Date()).getTime(),
                                            image: file,
                                            har: har_file,
                                            type: 'action'
                                        }
                                        actionErr[actionErr.length]=error;
                                        //console.log(JSON.stringify(error));
                                        this.waitFor(function() {
                                            this.emit('save.image', file, uu_id);
                                            return true;
                                        });
                                        this.waitFor(function() {
                                            this.emit('create.har', har_file, uu_id);
                                            return true;
                                        });
                                        this.waitFor(function() {
                                            this.emit('complete');
                                            return true;
                                        });
                                    }
                                } else if (typeof data.event != 'undefined') {
                                    if (!this.exists(element)) {
                                        var error = {
                                            id: uu_id,
                                            msg: "ELEMENT IS NOT FOUND : " + element,
                                            step: scriptStep,
                                            time: (new Date()).getTime(),
                                            image: file,
                                            har: har_file,
                                            type: 'action'
                                        }
                                        actionErr[actionErr.length]=error;
                                        //console.log(JSON.stringify(error));
                                        this.waitFor(function() {
                                            this.emit('save.image', file, uu_id);
                                            return true;
                                        });
                                        this.waitFor(function() {
                                            this.emit('create.har', har_file, uu_id);
                                            return true;
                                        });
                                        this.waitFor(function() {
                                            this.emit('complete');
                                            return true;
                                        });
                                    }
                                    this.each(data.event, function(self, e_data) {
                                        if (e_data.event == 'click') {
                                            this.click(element);
                                            var log = {
                                                type: "info",
                                                msg: "CLICK : " + element
                                            };
                                            //console.log(JSON.stringify(log));
                                        } else if (e_data.event == 'sendkey') {
                                            this.sendKeys(element, e_data.text);
                                            var log = {
                                                type: "info",
                                                msg: "SEND KEY : " + e_data.text
                                            };
                                            //console.log(JSON.stringify(log));
                                            if (e_data.enter == 'on') {
                                                this.sendKeys(element, this.page.event.key.Enter);
                                            }
                                        }
                                    });
                                } else if (typeof data.wait != 'undefined') {
                                    this.waitFor(function() {
                                        return this.wait(data.wait, function() {
                                            return true;
                                        });
                                    });
                                    var log = {
                                        type: "info",
                                        msg: "WAIT : " + data.wait + " (ms)"
                                    };
                                    //console.log(JSON.stringify(log));
                                } else if (typeof data.find_id != 'undefined') {
                                    var Count = 0;
                                    this.page.injectJs(LogPath + '/nMon_Agent/incloud/jquery.js');
                                    this.waitFor(function() {
                                        Count = this.evaluate(function(data) {
                                            var len = $(data.find_id + ":contains('" + data.find_text + "')").length;
                                            return len;
                                        }, {
                                            data: data
                                        });
                                        return true;
                                    });
                                    this.waitFor(function() {
                                        if (Count == 0) {
                                            var error = {
                                                id: uu_id,
                                                msg: "'" + data.find_text + "' 를  찾을수 없습니다.",
                                                step: scriptStep,
                                                time: (new Date()).getTime(),
                                                image: file,
                                                har: har_file,
                                                type: 'action'
                                            }
                                            actionErr[actionErr.length]=error;
                                            //console.log(JSON.stringify(error));
                                            this.waitFor(function() {
                                                this.emit('save.image', file, uu_id);
                                                return true;
                                            });
                                            this.waitFor(function() {
                                                this.emit('create.har', har_file, uu_id);
                                                return true;
                                            });
                                            this.waitFor(function() {
                                                this.emit('complete');
                                                return true;
                                            });
                                        } else {
                                            var log = {
                                                type: "info",
                                                msg: "'" + data.find_text + "' 를 " + Count + " 개 발견 하였습니다."
                                            };
                                            //console.log(JSON.stringify(log));
                                        }
                                        return true;
                                    });
                                } else if (typeof data.popup != 'undefined') {
                                    this.waitFor(function() {
                                        this.waitForPopup(/http/,
                                            function() {
                                                this.withPopup(/http/, function() {
                                                    recentURL = this.evaluate(function() {
                                                        return document.location.href
                                                    });
                                                });
                                            },
                                            function onTimeout() {
                                                var error = {
                                                    id: uu_id,
                                                    msg: "팝업 생성이 지연되고 있습니다.",
                                                    step: scriptStep,
                                                    time: (new Date()).getTime(),
                                                    image: file,
                                                    har: har_file,
                                                    type: 'action'
                                                }
                                                actionErr[actionErr.length]=error;
                                                //                                                          console.log(JSON.stringify(error));
                                                this.waitFor(function() {
                                                    this.emit('save.image', file, uu_id);
                                                    return true;
                                                });
                                                this.waitFor(function() {
                                                    this.emit('create.har', har_file, uu_id);
                                                    return true;
                                                });
                                                this.waitFor(function() {
                                                    this.emit('complete');
                                                    return true;
                                                });
                                            }, 7000);
                                        return true;
                                    });
                                    this.waitFor(function() {
                                        this.thenOpen(recentURL);
                                        //                                                var log = {type : "info", msg : "팝업 페이지로 이동 [ URL : " + recentURL + " ]"};
                                        //                                                console.log(JSON.stringify(log));
                                        return true;
                                    });
                                } else if (typeof data.custom_js != 'undefined') {
                                    var error_message = {
                                        type: "err_custom",
                                        msg: ""
                                    };
                                    this.page.injectJs(LogPath + '/nMon_Agent/incloud/jquery.js');
                                    this.waitFor(function() {
                                        try {
                                            eval(data.custom_js);
                                            return true;
                                        } catch (e) {
                                            if (typeof e.message == 'undefined') {
                                                e.log = "Custom JS " + e.line + " 번째 line에서 오류가 발생 하였습니다.";
                                            } else {
                                                e.log = "Custom JS 에서 오류가 발생 하였습니다.\n" + "log : " + e.message;
                                            }
                                            var error = {
                                                id: uu_id,
                                                msg: e.log,
                                                step: scriptStep,
                                                time: (new Date()).getTime(),
                                                image: file,
                                                har: har_file,
                                                type: 'action'
                                            }
                                            actionErr[actionErr.length]=error;
                                            //console.log(JSON.stringify(error));
                                            this.waitFor(function() {
                                                this.emit('save.image', file, uu_id);
                                                return true;
                                            });
                                            this.waitFor(function() {
                                                this.emit('create.har', har_file, uu_id);
                                                return true;
                                            });
                                            this.waitFor(function() {
                                                this.emit('complete');
                                                return true;
                                            });
                                            return true;
                                        }
                                    });
                                }
                                return true;
                            });
                        });
                        this.waitFor(function() {
                            this.emit('complete');
                            return true;
                        });
                   }
            ]);

            spooky.run(function() {});
        });


    spooky.on('export.har', function callHAR(address, title, startTime, endTime, resources, har_file, uu_id) {
        try {
            var HAR = createHAR.createHAR(address, title, startTime, endTime, resources);
            var w_har = fs.createWriteStream(LogPath + "/temp/" + uu_id + ".har");
                w_har.once('open', function(fd){
                w_har.write(JSON.stringify(HAR), function(err){w_har.end();});
            });
            w_har.on('finish', function(){
                var r_har =  fs.createReadStream(LogPath + "/temp/" + uu_id + ".har");
                var w_gz  =  fs.createWriteStream(LogPath + "/temp/" + uu_id + ".har.gz");
                var gzip = zlib.createGzip();
                
                r_har.pipe(gzip).pipe(w_gz);

                w_gz.on('finish', function(){
                    var cmd = 'rm -f ' + LogPath + "/temp/" + uu_id + ".har";
                    exec(cmd, function(error, stdout, stderr) {
                    });
                });
            });
        } catch (e) {
            var w_har = fs.createWriteStream(LogPath + "/temp/" + uu_id + ".har");
                w_har.once('open', function(fd){
                w_har.write(JSON.stringify(resources), function(err){w_har.end();});

            });
            w_har.on('finish', function(){
                var r_har =  fs.createReadStream(LogPath + "/temp/" + uu_id + ".har");
                var w_gz  =  fs.createWriteStream(LogPath + "/temp/" + uu_id + ".har.gz");
                var gzip = zlib.createGzip();
                r_har.pipe(gzip).pipe(w_gz);

                w_gz.on('finish', function(){
                    var cmd = 'rm -f ' + LogPath + "/temp/" + uu_id + ".har";
                    exec(cmd, function(error, stdout, stderr) {
                    });
                });
            });
        }
    });

    spooky.on('console', function(line) {
        console.log(line);
    });

    spooky.on('mkdir.path', function(path) {
        mkdirp(path, function(err) {});
    });

    spooky.on("recent.run", function(date) {
        //client.set(loc+":last", date);
        //client.set("script:"+ScriptID+":last", date);
    });


    spooky.on('callback', function(resultMap, uploadList, ScriptID) {
        try {
            callback(resultMap, uploadList, ScriptID);
        } catch (e) {

        }
    });


}

exports.spooky = spooky;