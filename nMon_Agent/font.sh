#!/bin/bash

export LC_ALL=ko_KR.UTF-8
export LANG=ko_KR.UTF-8

export WORK_PATH=$HOME/WMS/nMon_Agent

if [ ! -d /usr/share/fonts/window ]; then
 sudo cp -R $WORK_PATH/font /usr/share/fonts/window
 sudo fc-cache -f -v
fi