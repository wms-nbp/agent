var express      = require('express');
var app          = express();
var http         = require('http').Server(app);
var io           = require('socket.io')(http);

var path         = require('path');
var favicon      = require('serve-favicon');
var logger       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');

var routes       = require('./routes/index');
var daemon       = require('./agent/daemon');

var user = [];

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
daemon.start();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});


app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

var usernames = {};


io.sockets.on('connection',function(socket){
    socket.on('adduser', function(username){
            socket.username = username;
            usernames[username] = socket.id;
    });

    socket.on('disconnect', function(){
            delete usernames[socket.username];
            io.sockets.emit('updateusers', usernames);
    });

    socket.on('msg_user', function(usr, username, msg) {
            io.sockets.connected[usernames[usr]].emit('msg_user_handle', username, msg);
    });
});


http.listen(3000, function(){
  console.log('listening on *:3000');
});

module.exports = app;