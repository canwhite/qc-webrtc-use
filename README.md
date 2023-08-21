
## PS
* MESH
* SFU
* MCU


## run

cd frondend     
yarn serve


## part of config
```
-------janus
//本地
CANDIDATE="192.168.31.61" \
docker run --restart=always -d -v /Users/zack/Desktop/qc-webrtc-course/srs/conf:/usr/local/srs/conf/ -p 1935:1935 -p 1985:1985 -p 8085:8080 \
 --env CANDIDATE=$CANDIDATE -p 8000:8000/udp \
    ossrs/srs ./objs/srs -c conf/docker.conf


//按照线上的过程重新执行了一遍可以了
CANDIDATE="42.194.xxx.195"
docker run --restart=always -d -v /home/srs5/conf/:/usr/local/srs/conf/ -p 1935:1935 -p 1985:1985 -p 8085:8080 \
    --env CANDIDATE=$CANDIDATE -p 8000:8000/udp \
    ossrs/srs:5.0.30 ./objs/srs -c conf/docker.conf

//主要是docker ps 看ports是否出现
```

## origin参考学习

1. [WebRTC](https://juejin.cn/book/7168418382318927880/)


## License
详细请看协议说明
