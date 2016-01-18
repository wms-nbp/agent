var express    = require('express');
var router     = express.Router();

var agent      = require('../agent/agent');
var localip    = require('local-ip');
var path       = require('path-extra');
var root_path  = path.homedir()+"/owfs";
var socket     = require('socket.io-client')('http://localhost:3000');
var exec        = require('child_process').exec;
var fs          = require('fs');
var restler     = require('restler');
var LogPath     = path.homedir() + '/WMS';
//var gateway     = "10.113.169.245"; //DEV
var gateway     = "wms-gw.navercorp.com"; //REAL

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile('/home1/irteamsu/express/views/index.html');
});

router.post('/run', function(req, res, next) {
  console.log(req.body);
  if(req.body.script){
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    try{
        agent.spooky(res, req.body.script, callback, socket);
    } catch (e){console.log(e);}
  };
});

router.get('/image/*', function(req, res){
  res.set('Content-Type', 'image/png');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.sendFile(root_path + '/image/'+req.params[0], function (err){
    if (err){
      console.log(err);
      res.status(err.status).end();
    }
  });
});

router.get('/har/*', function(req, res){
	res.set('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.sendFile(root_path + '/har/'+req.params[0], function (err){
	    if (err){
	      console.log(err);
	      res.status(err.status).end();
	    }
	});
});



function getLocalIP(){
    var ip;
    localip('eth0', function(err, res){ip=res;});
    return ip;
}


function callback(res, result, tempList){
	res.json(result);
    tempList.forEach(function(file, i){
            fs.stat(file.ori_path+file.filename, function(err, stats){
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
            });

    });
}


module.exports = router;