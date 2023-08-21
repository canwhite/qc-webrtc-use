<template>
	<div style="width: 98%;height: 98vh;margin-top: 30px;">
		<el-row :gutter="20">
			<el-col :span="6">
				<div style="width: 100%;height: 800px;"  >
					<ul v-for="(item,index) in roomUserList" :key="index">
						<el-tag size="mini" @click="getStats"  type="success">{{'用户'+item.nickname}}</el-tag>
						<el-tag v-if="userInfo.userId === item.userId" type="danger" size="mini" @click="changeBitRate()"  >增加比特率</el-tag>
						<el-button size="mini" type="primary" v-if="userInfo.userId !== item.userId" @click="call(item)">通话</el-button>
						<el-button v-if="userInfo.userId === item.userId" size="mini" type="danger" @click="openVideoOrNot">切换</el-button>
					</ul>
				</div>
			</el-col>
			<el-col :span="18">
				<el-row>
					<div style="width: 800px;height: 200px;display: flex;flex-direction: row;align-items: center;">
						<el-form  :model="formInline" label-width="250px" class="demo-form-inline">
                            <el-form-item label="发送消息">
                                <el-input v-model="formInline.rtcmessage"  placeholder="消息"></el-input>
                            </el-form-item>
                            <el-form-item label="远端消息">
                                <div>{{formInline.rtcmessageRes}}</div>
                            </el-form-item>
                                                    
                            <el-form-item>
                                <el-button type="primary" @click="sendMessageUserRtcChannel">点击发送</el-button>
                            </el-form-item>
						</el-form>
					</div>
				</el-row>
				<el-row>
					<div style="display: flex;flex-direction: row;justify-content: flex-start;">
						<video @click="streamInfo('localdemo01')" id="localdemo01" autoplay controls muted></video>
						<video @click="streamInfo('remoteVideo01')" id="remoteVideo01" autoplay controls muted></video>
					</div>
				</el-row>
			</el-col>
		</el-row>
	</div>
</template>


<script>
	/**
	 *  核心就是PeerConnection
	 	创建PeerConnection实例：首先需要创建一个PeerConnection实例，可以使用new RTCPeerConnection()来实现。

		1.添加轨道：如果要发送音频或视频流，可以使用addTrack()方法将音频或视频轨道添加到PeerConnection中。

		2.创建本地描述：使用createOffer()方法创建一个本地的"offer"（提议）或createAnswer()方法创建一个本地的"answer"（回答）。

		3.设置本地描述：使用setLocalDescription()方法将本地描述设置到PeerConnection实例中。

		4.传递本地描述：将本地描述通过信令服务器发送给远程对等方。

		5.接收远程描述：接收远程对等方发送的描述，可以通过信令服务器或其他通信机制获取。

		6.设置远程描述：使用setRemoteDescription()方法将远程描述设置到PeerConnection实例中。

		7.添加ICE候选项：当收到ICE候选项时，使用addIceCandidate()方法将其添加到PeerConnection实例中。
	 */


    import {io} from "socket.io-client";

    //这部分算是全局的
	function handleError(error) {
	    // alert("摄像头无法正常使用，请检查是否占用或缺失")
	    console.error('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
	}
	
    //核心PC
	const PeerConnection = window.RTCPeerConnection ||
	        window.mozRTCPeerConnection ||
	        window.webkitRTCPeerConnection;

    //获取params方法
	function getParams(queryName) {
		const url = window.location.href;
		const query = decodeURI(url.split('?')[1]);
		const vars = query.split("&");
		for (let i = 0; i < vars.length; i++) {
		  const pair = vars[i].split("=");
		  if (pair[0] === queryName) {
		    return pair[1];
		  }
		}
		return null;
	}
	
	export default {
		name:'demo03-one2one',
		data() {
			return{
				linkSocket:undefined,
				rtcPcParams:{
				 iceServers: [
					{ url: "stun:stun.l.google.com:19302"},// 谷歌的公共服务
					]
				},
				roomUserList:[],
				userInfo:{},//用户信息
				formInline:{
					rtcmessage:undefined,
					rtcmessageRes:undefined,//响应
					
				
				},
				localRtcPc:undefined,
				rtcmessage:undefined,
				mapSender:[],//发送的媒体
				
			};
		},
		created() {

			//拿到useId去初始化
			if(getParams("userId")) {
				//然后我们去看init方法
				this.init(getParams("userId"),getParams("roomId"),getParams('userId'));
			}
		},
		methods:{

			//设置caller的VideoStream
			async setDomVideoStream(domId,newStream) {
				//自身的如果刷新要关掉重开
				const video = document.getElementById(domId);
				const stream = video.srcObject;
				//如果之前有，要先关了
				if(stream) {
				    stream.getAudioTracks().forEach(e => {
				        stream.removeTrack(e);
				    });
				    stream.getVideoTracks().forEach(e => {
				        stream.removeTrack(e);
				    });
				}
				//放上新stream
				video.srcObject = newStream;
				video.muted = true;
			},

			//设置callee的VideoStream
			setRemoteDomVideoStream(domId,track) {
				const video = document.getElementById(domId);
				const stream = video.srcObject;
				//远方的如果有推流，将媒体轨道添加到媒体流中
				if(stream) {
					stream.addTrack(track);
				}else{
					//如果没有媒体流，就新建一个
					const newStream = new MediaStream();
					newStream.addTrack(track);
					video.srcObject = newStream;
					video.muted = true;
				}
			},


            //初始化主要是
			init(userId,roomId,nickname) {


				const that = this;
				//拼装一个userInfo
				this.userInfo = {
					userId:userId,
					roomId:roomId,
					nickname:nickname
				};
				//将socket初始化
				this.linkSocket = io(this.$serverSocketUrl, {
					reconnectionDelayMax: 10000,
					transports: ["websocket"],
					query: {
					  "userId": userId,
					  "roomId": roomId,
					  "nickname":nickname
					}
				});

				//socket监听
				this.linkSocket.on("connect",(e) => {
					console.log("server init connect success",that.linkSocket);
				});

				//监听userList
				this.linkSocket.on("roomUserList",(e) => {
					console.log("roomUserList",e);
					that.roomUserList = e;					
				});

				//监听msg，这个是大头
				this.linkSocket.on("msg",async (e) => {
					console.log("msg",e);
					if(e.type === 'join' || e.type === 'leave') {
						setTimeout(() => {
							const params = {"roomId":getParams('roomId')};
							that.linkSocket.emit('roomUserList',params);
						},1000);
					}
					if(e.type === 'call') {
						//执行时本地的onCall
						await that.onCall(e);
					}
					if(e.type === 'offer') {
						//执行时本地对远程的Offer监听
						await that.onRemoteOffer(e.data.userId,e.data.offer);
					}
					if(e.type === 'answer') {
						//对远程的answer监听
						await that.onRemoteAnswer(e.data.userId,e.data.answer);
					}
					if(e.type === 'candidate') {
						//对远程的Ice候选监听
						that.localRtcPc.addIceCandidate(e.data.candidate);
					}
				});
				//报错监听
				this.linkSocket.on("error",(e) => {
					console.log("error",e);
				});
			},

			
			/**
			 * 获取设备 stream
			 * @param constraints
			 * @returns {Promise<MediaStream>}
			 */
			async getLocalUserMedia(constraints) {
			    return await navigator.mediaDevices.getUserMedia(constraints).catch(handleError);
			},

            //初始化caller,call方法是上边的通话方法调用的
			//也是一切的入口
			async call(item) {
				this.initCallerInfo(getParams('userId'),item.userId);
				const params = {
					"userId": getParams('userId'),"targetUid":item.userId};
				//向心灵服务器发送信息
				this.linkSocket.emit('call',params);
			},
			//信令服务器转发callee的信息时，先要将其初始化
			async onCall(e) {
				console.log("远程呼叫：",e);
				await this.initCalleeInfo(e.data.targetUid,e.data.userId);
			},
			async initCalleeInfo(localUid,fromUid) {
				//初始化pc
				this.localRtcPc = new PeerConnection();
				//初始化本地媒体信息
				const localStream = await this.getLocalUserMedia({ audio: true, video: true });
				for (const track of localStream.getTracks()) {
				    this.localRtcPc.addTrack(track);
				}
				// dom渲染
				await this.setDomVideoStream("localdemo01",localStream);
				//监听
				this.onPcEvent(this.localRtcPc,localUid,fromUid);
				
			},

            //先调用
			async initCallerInfo(callerId,calleeId) {
				this.mapSender = [];
				//初始化pc
				this.localRtcPc = new PeerConnection();
				//获取本地媒体并添加到pc中
				const localStream = await this.getLocalUserMedia({ audio: true, video: true });
				for (const track of localStream.getTracks()) {
				    this.mapSender.push(this.localRtcPc.addTrack(track));
				  }
				  // 本地dom渲染
				await this.setDomVideoStream("localdemo01",localStream);


				//回调监听，注意这一步，这是PC的一些监听
				this.onPcEvent(this.localRtcPc,callerId,calleeId);
				//创建offer
				const offer = await this.localRtcPc.createOffer({iceRestart:true});
				//设置offer未本地描述，这个是往pc注入
				//目的是将本地的描述信息（offer）存储在本地的 PeerConnection
				await this.localRtcPc.setLocalDescription(offer);
				//发送offer给被呼叫端
				const params = {"targetUid":calleeId,"userId":callerId,"offer":offer};
				//调用socket的emit方法
				this.linkSocket.emit("offer",params);
			},


			onPcEvent(pc,localUid,remoteUid) {
				const that = this;

				//IM部分使用的是channel
				this.channel = pc.createDataChannel("chat");

				//监听媒体轨道
				pc.ontrack = function(event) {
					console.log(event);
					that.setRemoteDomVideoStream("remoteVideo01",event.track);
				};
				pc.onnegotiationneeded = function(e) {
					console.log("重新协商",e);
				};

				//IM部分发送就用channel send，接收就在这里了
				pc.ondatachannel = function(ev) {
				  console.log('Data channel is created!');
				  ev.channel.onopen = function() {
				    console.log('Data channel ------------open----------------');
				  };
				  //主要是ondatachannel里的onmessage接收信息
				  ev.channel.onmessage = function(data) {
				    console.log('Data channel ------------msg----------------',data);
					//通过channel去获取数据
					that.formInline.rtcmessageRes = data.data;
				  };
				  ev.channel.onclose = function() {
				    console.log('Data channel ------------close----------------');
				  };
				};


				pc.onicecandidate = (event) => {
				  if (event.candidate) {
					that.linkSocket.emit('candidate',{'targetUid':remoteUid,"userId":localUid,"candidate":event.candidate});
				  } else {
				    /* 在此次协商中，没有更多的候选了 */
					console.log("在此次协商中，没有更多的候选了");
				  }
				};
			},
			sendMessageUserRtcChannel() {

				if(this.localRtcPc === undefined) { 
					alert("请先通话，完成通信");
					return;
				}
				if(!this.channel) {
					this.$message.error("请先建立webrtc连接");
				}
				this.channel.send(this.formInline.rtcmessage);
				this.formInline.rtcmessage = undefined;
			},

			//监听接收远方offer
			async onRemoteOffer(fromUid,offer) {
				if(this.localRtcPc === undefined) { 
					alert("请先通话，完成通信");
					return;
				}
				this.localRtcPc.setRemoteDescription(offer);

				//接收到offer之后返回answer
				const answer = await this.localRtcPc.createAnswer();
				//设置本地描述，存储
				await this.localRtcPc.setLocalDescription(answer);
				const params = {"targetUid":fromUid,"userId":getParams("userId"),"answer":answer};
				this.linkSocket.emit("answer",params);
				
			},


			async onRemoteAnswer(fromUid,answer) {
				await this.localRtcPc.setRemoteDescription(answer);
			},

			/**增加比特率 */
			changeBitRate() {
				if(this.localRtcPc === undefined) { 
					alert("请先通话，完成通信");
					return;
				}
				console.log("------PC ---- ",this.localRtcPc);
				//getSenders方法，可获取每个媒体轨道对应RTCRtpSender对象
				//可以判断媒体类型
				const senders = this.localRtcPc.getSenders();
				const send = senders.find((s) => s.track.kind === 'video');
				//获得属性
				const parameters = send.getParameters();
				//设置最大比特
				parameters.encodings[0].maxBitrate = 1 * 1000 * 1024;
				//重新设置新属性
				send.setParameters(parameters);
			}
			,
			/**
			 * 打开或关闭摄像头
			 */
			openVideoOrNot() {
				if(this.localRtcPc === undefined) { 
					alert("请先通话，完成通信");
					return;
				}
				const senders = this.localRtcPc.getSenders();
				const send = senders.find((s) => s.track.kind === 'video');
				send.track.enabled = !send.track.enabled; //控制视频显示与否
			},
			/**
			 * 获取屏幕分享的媒体流
			 * @author suke
			 * @returns {Promise<void>}
			 */
			async getShareMedia() {
			    const constraints = {
			        video:{width:1920,height:1080},
					audio:true
			    };
			    if (window.stream) {
			        window.stream.getTracks().forEach(track => {
			            track.stop();
			        });
			    }
			    return await navigator.mediaDevices.getDisplayMedia(constraints).catch(handleError);
			},


			streamInfo(domId) {
				const video = document.getElementById(domId);
				console.log(video.srcObject);
			},

			
			/**获取状态 */
			getStats() {

				if(this.localRtcPc === undefined) { 
					alert("请先通话，完成通信");
					return;
				}
				const that = this;
				const senders = this.localRtcPc.getSenders();
				const send = senders.find((s) => s.track.kind === 'video');
				console.log(send.getParameters().encodings);
				let lastResultForStats;//上次计算结果
				setInterval(() => {
					//主要是getStats方法
					that.localRtcPc.getStats().then(res => {
						//结果循环
						res.forEach(report => {
						  let bytes;
						  let headerBytes;
						  let packets;
						  // console.log(report)
						  //出口宽带 outbound-rtp  入口宽带 inbound-rtp
						  if (report.type === 'outbound-rtp' && report.kind === 'video') {
								const now = report.timestamp;
								bytes = report.bytesSent;
								headerBytes = report.headerBytesSent;
						        packets = report.packetsSent;	
								console.log(bytes,headerBytes,packets);
							if (lastResultForStats && lastResultForStats.has(report.id)) {
								const bf = bytes - lastResultForStats.get(report.id).bytesSent;
								const hbf = headerBytes - lastResultForStats.get(report.id).headerBytesSent;
								const pacf = packets - lastResultForStats.get(report.id).packetsSent;
								const t = now - lastResultForStats.get(report.id).timestamp;
								// calculate bitrate
							  const bitrate = Math.floor(8 * bf / t);
							  const headerrate = Math.floor(8 * hbf / t);
							  const packetrate = Math.floor(1000 * pacf / t);
							  console.log(`Bitrate ${bitrate} kbps, overhead ${headerrate} kbps, ${packetrate} packets/second`);
								}
							}
						});
						lastResultForStats = res;
					});
				},4000);	
			},
		}
	};
</script>

<style scoped>
	#localdemo01{
		width: 300px;
		height: 200px;
		
	}
	#remoteVideo01{
		width: 300px;
		height: 200px;
	}
</style>