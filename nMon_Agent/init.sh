#!/bin/bash

export LC_ALL=ko_KR.UTF-8
export LANG=ko_KR.UTF-8

export WORK_PATH=$HOME/WMS/nMon_Agent
export NODE_HOME=$WORK_PATH/bin/node
export NODE_BIN=$NODE_HOME/bin

export CASPERJS_HOME=$WORK_PATH/node_modules/casperjs
export CASPERJS_BIN=$CASPERJS_HOME/bin

export PHANTOMJS_HOME=$CASPERJS_HOME/node_modules/phantomjs/lib/phantom
export PHANTOMJS_BIN=$PHANTOMJS_HOME/bin

export FOREVER_HOME=$WORK_PATH/node_modules/forever
export FOREVER_BIN=$FOREVER_HOME/bin


PATH=$PATH:$HOME/bin:$NODE_BIN:$PHANTOMJS_BIN:$CASPERJS_BIN:$FOREVER_BIN
export PATH

chmod 777 $NODE_BIN/node
chmod 777 $NODE_BIN/../lib/node_modules/npm/bin/npm-cli.js
chmod 777 $NODE_HOME/lib/node_modules/npm/bin/node-gyp-bin/node-gyp
chmod 777 $WORK_PATH/kill.sh

if [ ! -f $NODE_BIN/npm ]; then
 ln -s $NODE_BIN/../lib/node_modules/npm/bin/npm-cli.js $NODE_BIN/npm
fi

npm install


cp -f $WORK_PATH/incloud/bootstrap.js $CASPERJS_BIN/bootstrap.js
cp -f $WORK_PATH/incloud/phantomjs $PHANTOMJS_BIN/phantomjs

chmod 777 $CASPERJS_BIN/casperjs
chmod 777 $PHANTOMJS_BIN/phantomjs


forever stop app.js
forever start app.js