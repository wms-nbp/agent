var request     = require('request');
var crontab     = require('node-crontab');
var localip     = require('local-ip');
var spookyProc  = require('./agent_daemon');
var exec        = require('child_process').exec;
var fs          = require('fs');
var mkdirp      = require('mkdirp');
var path        = require('path-extra');
var restler     = require('restler');
var LogPath     = path.homedir() + '/WMS';
//var gateway     = "10.113.169.245"; //DEV
var gateway     = "wms-gw.navercorp.com"; //REAL

function start() {

    function getLocalIP(){
        var ip;
        localip('eth0', function(err, res){ip=res;});
        if(ip=='' || ip == 'undefined' || ip == null){localip('eth1', function(err, res){ip=res;});}
        return ip;
    }

    function run(agentName){
        var runid = crontab.scheduleJob('*/1 * * * *', function(){
        setTimeout(function(){
                        request.post({url:'http://'+gateway+'/get/schedule', form : {name : agentName}}, function Callback(err, httpResponse, body) {
                                if (err) {
                                        return console.error('get schedule load failed : ', err);
                                }

                                var Result = JSON.parse(body);
                                Result.forEach(function(Index, i){
                                        var Script       = Index.ScriptFile;
                                        var ScriptID     = Index.ScriptID;
                                        var Version      = Index.Version;
                                        var AgentStatus  = Index.AgentStatus;
                                        var ScriptStatus = Index.ScriptStatus;
                                        var ProfileDB    = Index.ProfileDB;
                                        var Interval     = Index.Interval;
                                        var Login        = Index.Login;
                                        if(AgentStatus==1 && ScriptStatus==1){
                                                fs.exists(LogPath + '/pid/' + ScriptID + '.pid', function(exists){
                                                        if(!exists){
                                                                var IntervalTime = Interval.split(",")[0];
                                                                var IntervalType = Interval.split(",")[1];
                                                                var CronTime  = '*/' + IntervalTime + ' * * * *';
                                                                if     (IntervalType == 'h'){CronTime = '* */'   + IntervalTime  + ' * * *';}
                                                                else if(IntervalType == 'd'){CronTime = '* * */' + IntervalTime  + ' * *';}
                                                                setTimeout(function(){
                                                                    var jobid = crontab.scheduleJob(CronTime, function(){
                                                                        setTimeout(function(){
                                                                        	try{
                                                                                spookyProc.spooky(Script, ScriptID, Version, Login, agentName, ProfileDB, callback);
                                                                        	} catch (e){console.log(e);}
                                                                        }, 1000*i);
                                                                    }, null, null, false);
                                                                    var stream = fs.createWriteStream(LogPath + '/pid/' + ScriptID + '.pid');
                                                                            stream.once('open', function(fd){
                                                                            stream.write(jobid.toString()+"#"+Interval);
                                                                            stream.end();
                                                                    });
                                                                },i*10);
                                                        } else {
                                                            var data = fs.readFile(LogPath + '/pid/' + ScriptID + '.pid', function (err, data){
                                                                if (err) {
                                                                    console.error("pid flie read faild");
                                                                }
                                                                var old_jobid = data.toString().split("#")[0];
                                                                var old_Time  = data.toString().split("#")[1];
                                                                var new_Time  = Interval;
                                                                if(old_Time!=new_Time){
                                                                    crontab.cancelJob(old_jobid);
                                                                    var cmd = 'rm -f ' + LogPath + '/pid/' + ScriptID + '.pid';
                                                                    exec(cmd, function(error, stdout, stderr) {});
                                                                } else {
                                                                	var deleyTime = (new Date()) - (new Date(parseInt(old_jobid)));
                                                                	var checkTime = 0;
                                                                	var interval_type = old_Time.split(",")[1];
                                                                	var interval_time = old_Time.split(",")[0];
                                                                	if(interval_type=="m"){
                                                                		checkTime = 1000*60*(parseInt(interval_time));
                                                                	} else if(interval_type=="h"){
                                                                		checkTime = 1000*60*60*(parseInt(interval_time));
                                                                	} else if(interval_type=="d"){
                                                                		checkTime = 1000*60*60*24*(parseInt(interval_time));
                                                                	}
                                                                	if(deleyTime > checkTime){
                                                                		crontab.cancelJob(old_jobid);
                                                                        var cmd = 'rm -f ' + LogPath + '/pid/' + ScriptID + '.pid';
                                                                        exec(cmd, function(error, stdout, stderr) {});
                                                                        try{
	                                                                        var cmd = '$WORK_PATH/kill.sh';
	                                                                        exec(cmd, function(error, stdout, stderr) {
	                                                                        });
                                                                        } catch (e){
                                                                        	console.log(e);
                                                                        }
                                                                	}
                                                                }
                                                            });
                                                        }
                                                });
                                        }
                                });
                        });
                }, 50000);
        });
    }


//    function kill(){
//        crontab.scheduleJob("*/1 * * * *", function(){
//            setTimeout(function(){
//                var cmd = '$WORK_PATH/kill.sh';
//                exec(cmd, function(error, stdout, stderr) {
//                });
//            },55000);
//        });
//    }
    
    
    function callback(result, tempList, ScriptID){
    	if(typeof result.error.javascript != 'undefined'){
	    	result.error.javascript.forEach(function(index, i){
	    		fs.exists(LogPath+"/temp/"+index.id+".jpg", function(exists){
	    			if(!exists){
	    				if(typeof result.error.action != 'undefined'){
	    					result.error.javascript[i].id = result.error.action[0].id;
	    					result.error.javascript[i].image = result.error.action[0].image;
	    					result.error.javascript[i].har = result.error.action[0].har;
	    					if(result.error.javascript.length==(i+1)){
	    		    			sendResult(result, tempList, ScriptID);	
	    		    		}
	    				}
	    			} else{
	    				if(result.error.javascript.length==(i+1)){
			    			sendResult(result, tempList, ScriptID);	
			    		}
	    			}
	    		});
	    	});
    	} else {
    		sendResult(result, tempList, ScriptID);
    	}
    	
    }
    
    function sendResult(result, tempList, ScriptID){
    	request.post({url:'http://'+gateway+'/result', form : {result: JSON.stringify(result)}}, function Callback(err, httpResponse, body) {
            if (err) {
                    return console.error('send result failed : ', err);
            }
	    });
	    var cmd = 'rm -f ' + LogPath + '/pid/' + ScriptID + '.pid';
	    exec(cmd, function(error, stdout, stderr) {
	    });
	    tempList.forEach(function(file, i){
	            fs.stat(file.ori_path+file.filename, function(err, stats){
	            	if(typeof stats.size != 'undefined' || stats.size != null){
	                    restler.post('http://'+gateway+'/upload/data', {
	                        multipart : true,
	                        data: {
	                                  'name' : file.filename,
	                                  'path' : encodeURI(file.new_path),
	                                  'file' : restler.file(file.ori_path+file.filename, null, stats.size, null, 'image/jpg')
	                              }
	                    }).on('complete', function(data){
	                        var cmd = 'rm -f ' + file.ori_path + file.filename;
	                        exec(cmd, function(error, stdout, stderr) {});
	                    });
	            	}
	            });
	
	    });
    }
    

    function envSetting(){
        mkdirp(LogPath+'/pid', function(err){});
        mkdirp(LogPath+'/log', function(err){});
        mkdirp(LogPath+'/temp', function(err){});
        var cmd = 'rm -f ' + LogPath + '/pid/*';
        exec(cmd, function(error, stdout, stderr) {
        });
    }
    
    function init(){
        envSetting(); 
        var localip  = getLocalIP();
        var formData = { ip : localip }; 
            console.log("init");
            console.log(localip);
            request.post({url:'http://'+gateway+'/get/agent/status', form : formData}, function Callback(err, httpResponse, body) {
                if (err) {
                        return console.error('get agent status load failed : ', err);
                }
                                  
                var Result = JSON.parse(body);
                var agentName = Result[0].NAME;

                if(agentName==''){
                    request.post({url:'http://'+gateway+'/req/agent/add', form : formData}, function Callback(err, httpResponse, body) {
                            if (err){
                                    return console.error('set agent add failed : ', err);
                            }
                    });
	            } else if(typeof agentName=='undefined') {
	                setTimeout(function(){
	                    init();
	                }, 10000);
	            }
	            else {
	                run(agentName);
//	                kill();
	            }
            });
    }


    init();
    console.log('daemon has started.');

}

exports.start = start;