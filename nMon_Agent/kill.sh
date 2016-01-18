#!/bin/bash

real=$(date | awk '{print $5}' | awk -F':' '{print $1":"$2}')
pid=$(ps -ef | grep phantomjs | grep spooky | awk '{print $2 " " $5}')
count=0

for index in $pid
do
  check=$(($count%2))
  count=$(($count+1))
  if [ $check -eq 0 ]
  then
    c_pid=$index
  else
    if [ "$index" != "$real" ]
    then
      $(kill -9 $c_pid)
    fi
  fi

done