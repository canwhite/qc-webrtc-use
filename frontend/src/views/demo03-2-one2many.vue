<template>
	<div class="container">

		<!-- 个人信息部分 -->
		<el-row style="padding: 20px;">
			<el-descriptions title="个人信息">
			    <el-descriptions-item label="用户名">{{formInline.nickname}}</el-descriptions-item>
			    <el-descriptions-item label="唯一身份识别">{{formInline.userId}}</el-descriptions-item>
			    <el-descriptions-item label="房间号">{{formInline.roomId}}</el-descriptions-item>
			</el-descriptions>
			<div id="controlPanl" style="position: fixed;left: 10px;bottom: 20px;width: 150px;height: 150px;background-color: aliceblue;color: red;display: block;"></div>
		</el-row>

		<!-- 表格部分 -->
		<el-row >
			<el-col :span="6">
				<el-table
				    :data="roomUserList"
				    border
				    style="width: 100%">
				    <el-table-column
				      prop="userId"
				      label="ID">
				    </el-table-column>
				    <el-table-column
				      prop="nickname"
				      label="账号">
				    </el-table-column>
					<el-table-column
					  prop="roomId"
					  label="房间">
					</el-table-column>
					<el-table-column
					  prop="pub"
					  label="publisher">
					</el-table-column>
				  </el-table>
				 
			</el-col>

			<!-- 切换直播背景 -->
			<el-col :span="6" v-if="formInline.pub === 'pub'">
				<div style="height: 75vh;overflow-y: auto;display: flex;flex-direction: row;width: 100%;">
					<div style="width: 200px;text-align: left;padding: 20px;">
						<label>直播开始后点击背景即可切换直播背景</label>
						<vue-select-image
						  :dataImages="bgUrls"
						  @onselectimage="onSelectImage">
						</vue-select-image>
					</div>
					<div id="danmucontainer" style="width: 100px;height: 50vh;"></div>
				</div>
			</el-col>

			<!-- 发送弹幕 -->
			<el-col :span="10">
				<el-row>
					<div id="allVideo" >
						<div v-if="formInline.pub !== 'pub'" id="publisherVideoParent"  style="position: relative;width: 300px;height: 250px;">
							<video width="300px" height="250px"  id="publisherVideo" style="position: absolute;left: 0;height: auto;" autoplay  muted></video>
						</div>
						<div v-if="formInline.pub === 'pub'" id="localDomId">
							<div id="localdemo01Parent" style="position: relative;width: 600px;height: 250px;display: flex;flex-direction: row;">
								<video id="localdemo01" controls width="300px" height="250px" style="position: absolute;left: 0;height: auto;" autoplay  muted></video>
							</div>
							<canvas  id="output_canvas" class="output_canvas" style="width: 768px;height: 480px;"></canvas>
						</div>
					</div>
				</el-row>
				<el-row>
					<div style="width: 50%;display: flex;flex-direction: row;height: auto;">
						<el-input v-model="message"></el-input>
						<el-button @click="sendMsgToPub()">发送弹幕</el-button>
					</div>
				</el-row>
			</el-col>
		</el-row>
	
		
	</div>
</template>

<script>
	// 图片选择器
	import VueSelectImage from 'vue-select-image'
	require('vue-select-image/dist/vue-select-image.css')
	//弹幕组件
	import Danmaku from 'danmaku';
	//浏览器指纹获取
	import FingerprintJS from '@fingerprintjs/fingerprintjs';
	const fpPromise = FingerprintJS.load()
	//socket
	const { io } = require("socket.io-client");
	//webrtc adapter
	var PeerConnection = window.RTCPeerConnection ||
	        window.mozRTCPeerConnection ||
	        window.webkitRTCPeerConnection;
	// 虚拟背景
	import * as SFS from "@mediapipe/selfie_segmentation";
	//FPS计算工具
	import FPSC from '@mediapipe/control_utils'
	

	var canvasElement ;
	var canvasCtx ;
	var image ;
	var selfieSegmentation = null;
	/**
	 * 设备列表获取
	 */
	var localDevice = null;
	function initInnerLocalDevice(){
			const that  = this
		     localDevice = {
		        audioIn:[],
		        videoIn: [],
		        audioOut: []
		    }
		    let constraints = {video:true, audio: true}
		    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
		        console.log("浏览器不支持");
		        return;
		    }
		    navigator.mediaDevices.getUserMedia(constraints)
		        .then(function(stream) {
		            stream.getTracks().forEach(trick => {
		                trick.stop()
		            })
					
		            // List cameras and microphones.
		            navigator.mediaDevices.enumerateDevices()
		                .then(function(devices) {
		                    devices.forEach(function(device) {
		                        let obj = {id:device.deviceId, kind:device.kind, label:device.label}
		                        if(device.kind === 'audioinput'){
		                            if(localDevice.audioIn.filter(e=>e.id === device.deviceId).length === 0){
		                                localDevice.audioIn.push(obj)
		                            }
		                        }if(device.kind === 'audiooutput'){
		                            if(localDevice.audioOut.filter(e=>e.id === device.deviceId).length === 0){
		                                localDevice.audioOut.push(obj)
		                            }
		                        }else if(device.kind === 'videoinput' ){
		                            if(localDevice.videoIn.filter(e=>e.id === device.deviceId).length === 0){
		                                localDevice.videoIn.push(obj)
		                            }
		                        }
		                    });
		                })
		                .catch(handleError);
		
		        })
		        .catch(handleError);
		}
	function getParams(queryName){
		let url = window.location.href
		let query = decodeURI(url.split('?')[1]);
		let vars = query.split("&");
		for (var i = 0; i < vars.length; i++) {
		  var pair = vars[i].split("=");
		  if (pair[0] === queryName) {
		    return pair[1];
		  }
		}
		return null;
	}
	function handleError(error) {
		alert("缺少必要的音频或视频输入驱动设备")
	    console.error('navigator.MediaDevices error: ', error.message, error.name);
	}

	//
	var RtcPcMaps = new Map();
	var dataChannelMap = new Map();// 数据通道map
	//socket的协议是ws://
	const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
	
	export default {
		name:'demo03-one2many',
		components: { VueSelectImage },
		data(){
			return{
				linkSocket:undefined,
				centerDialogVisible:false,
				rtcPcParams:{
					// iceTransportPolicy: 'relay', //强制走中继
					iceServers: [
						// {urls: 'turn:x.x.x.x:3478', username:'suc', credential:'suc001'}
					]
				},
				message:undefined,//弹幕
				roomUserList:[],
				localDevice:{
					audioIn:[],
					videoIn: [],
					audioOut: []
				},
				mediaStatus:{
					audio:false,
					video:false
				},
				
				formInline:{
					rtcmessage:undefined,
					rtcmessageRes:undefined,//响应
					videoId:undefined,
					audioInId:undefined,
					nickname:undefined,//展示昵称
					roomId:undefined,//房间号
					pub:undefined,//'pub'
				
				},
				statsTimerMap:new Map(),//计时器
				lastPeerStatsMap:new Map(),//上一次统计信息
				localStream:undefined,
				rtcmessage:undefined,
				constraintOpt:{
					audio:true,
					video:{
						width: 1920, height: 1080
					}
				},
				bgUrls:[
					{id:1,src:require('@/assets/bg.jpg')},
					{id:2,src:require('@/assets/bg2.jpg')},
					{id:3,src:require('@/assets/bg3.jpg')},
					{id:4,src:require('@/assets/logo.png')},
					],
				selectedImg:undefined,
				rfId:null,
				virtualMediaStream:null,//虚拟流
				publisher:undefined,//主播
				danmaku:undefined,//弹幕组件

			}
		},
		created() {
			//先初始化好本地设备
			initInnerLocalDevice()
			//拿到参数
			this.formInline.nickname = getParams("nickname");
			this.formInline.roomId = getParams("roomId");
			this.formInline.userId = getParams("userId");
			this.formInline.pub = getParams("pub")? getParams("pub") : 'no';
			//如果都有值的话，初始化
			if(this.formInline.nickname && this.formInline.roomId && this.formInline.userId){
				this.init()
			}

		},
		mounted() {
			
		},
		methods:{
			//选择背景
			async onSelectImage(e){
				await this.changeBg(e.src)
			},
			//重新初始化分割模型并获取新的流
			async changeBg(src){
				await this.initVb(src)
				 //虚拟背景流,这里是起点，用于触发我们的AI工具
				this.virtualMediaStream = await this.virtualBg()
				// this.setDomVideoStream("virtualBgVideoDom",this.virtualMediaStream);
				//切换流
				await this.changeRemoteStream(this.virtualMediaStream);
			},
			/**
			 * 初始化虚拟背景
			 */
			initVb(src){
				canvasElement = document.getElementById('output_canvas');
				canvasCtx = canvasElement.getContext('2d');
				image = new Image();
				image.src = src
				//这个动态地址就是下载具体版本模型的地方，因为 cdn地址在国内访问比较慢，
				//因此我将其下载到本地，然后通过 nginx 代理通过区域网访问对应模型。
				selfieSegmentation = new SFS.SelfieSegmentation({locateFile: (file) => {
					console.log(file);
					return `http://127.0.0.1:8080/${file}`;//ng  代理模型文件夹
				  	// return `https://cdn.jsdelivr.'net/npm/@mediapipe/selfie_segmentation@0.1.1632777926/${file}`;
				}});				
				selfieSegmentation.setOptions({
					staticImageModel:false,
					maxNumHands: 2,
					modelSelection: 1, //0 通用模型 1 景观模型
					minDetectionConfidence: 0.5,
					minTrackingConfidence: 0.5,
				});
				//处理结果
				selfieSegmentation.onResults(this.handleResults);
				//FPS计算
				if(!this.fpsControl){
					this.fpsControl = new FPSC.FPS()
					//effect  mask or both
					let pal = new FPSC.ControlPanel(document.getElementById('controlPanl'),{selfieMode: true, modelSelection: 1, effect: 'both',}).add([this.fpsControl])
				}
				
			},
			//切换发送的远程流
			async changeRemoteStream(stream){
				//先获取要替换的流 过滤音频 仅仅保留视频
				const [videoTrack] = stream.getVideoTracks();
				RtcPcMaps.forEach(e => {
					const senders = e.getSenders();
					const send = senders.find((s) => s.track.kind === 'video')
					send.replaceTrack(videoTrack)
				})
			},
			handleResults(results) {
				// 更新帧率控制
				this.fpsControl.tick();

				// 准备新的帧
				canvasCtx.save();
				// 清除画布
				canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
				// 绘制分割遮罩
				canvasCtx.drawImage(results.segmentationMask, 0, 0, canvasElement.width, canvasElement.height);

				// 将图像绘制为新的背景，将分割视频绘制在其上方
				canvasCtx.globalCompositeOperation = 'source-out';
				// 绘制图像
				canvasCtx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvasElement.width, canvasElement.height);
				canvasCtx.globalCompositeOperation = 'destination-atop';
				// 绘制分割视频
				canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
				// 完成，恢复画布状态
				canvasCtx.restore();
			},
			/**
			 * 监听触发模型处理
			 */
			async virtualBg(){
				const that = this
				let video = document.getElementById('localdemo01')
				if(this.rfId){
					cancelAnimationFrame(this.rfId)
				}
				let lastTime = performance.now();
				async function getFrames() {
					const now = video.currentTime;
					//高FPS 尝试将下面的判断注释
					if(now > lastTime){ 
						await selfieSegmentation.send({image: video});
					}
					lastTime = now;
					//无限定时循环 退出记得取消 cancelAnimationFrame() 
					that.rfId = requestAnimationFrame(getFrames);
					
				};
				getFrames()
				return canvasElement.captureStream(25);
			},
			async setDomVideoStream(domId,newStream){
				let video = document.getElementById(domId)
				let stream = video.srcObject
				if(stream){
				    stream.getAudioTracks().forEach( e=>{
				        stream.removeTrack(e)
				    })
				    stream.getVideoTracks().forEach(e=>{
				        stream.removeTrack(e)
				    })
				}
				video.srcObject =newStream
				video.muted = true
			
			},
			/**
			 * 初始化弹幕容器
			 */
			initDanmuContainer(){
				if(this.formInline.pub==='pub'){//主播
					//增加弹幕组件
					this.danmaku = new Danmaku({
					    container: document.getElementById('localdemo01Parent'),
						speed: 30
					});
				}else{ //客户端
					this.danmaku = new Danmaku({
					    container: document.getElementById('publisherVideoParent'),
						speed: 30
					});
				}
				//首条弹幕
				this.danmaku.emit({text: '直播间已开启，请踊跃发言', style: {fontSize: '20px',color: '#ff5500'}})
			},
			/**
			 * 指定video dom 设置媒体轨道
			 * @param {Object} domId
			 * @param {Object} trick
			 */
			setDomVideoTrick(domId,trick){
				let video = document.getElementById(domId)
				let stream = video.srcObject
				if(stream){
					stream.addTrack(trick)
				}else {
					stream = new MediaStream()
					stream.addTrack(trick)
					video.srcObject = stream
					video.controls = true;
					video.autoplay = true;
					video.muted = false;
				}
			},

			//初始化信令服务器相关
			init(){
				//信令服务器初始化
				const that = this
				this.linkSocket = io(this.$serverSocketUrl, {
					reconnectionDelayMax: 10000,
					transports: ["websocket"],
					// path:'/mediaServerWsUrl',//和服务端保持一致 namespace
					query: that.formInline
				});


				//监听connnect，如果建立了连接，就初始化房间和相关的内容
				this.linkSocket.on("connect",async (e)=>{
					console.log("server init connect success",that.linkSocket)
					//视频会议初始化
					setTimeout(async () => {
						if(that.roomUserList.length){
						    await that.initMeetingRoomPc()
							that.initDanmuContainer()
						}
					},2000)
				})
				//监听roomList的信息
				this.linkSocket.on("roomUserList",(e)=>{
					console.log("roomUserList",e)
					that.roomUserList = e
				})

				//msg是大头
				this.linkSocket.on("msg",async (e)=>{
					console.log("msg",e)
					//监听离开和进入，如果有此类情况，刷新列表
					if(e['type'] === 'join' || e['type'] === 'leave'){
						const userId = e['data']['userId']
						const nickname = e['data']['nickname']
						if(e['type'] === 'join'){
							that.$message.success(nickname+" 加入房间")
						}else{
							that.$message.success(nickname+" 离开房间")
						}
						setTimeout(()=>{
							that.linkSocket.emit('roomUserList',{roomId:that.formInline.roomId})
						},1000)
					}
					if(e['type'] === 'call'){
						await that.onCall(e)
					}
					if(e['type'] === 'offer'){
						await that.onRemoteOffer(e['data']['userId'],e['data']['offer'])
					}
					if(e['type'] === 'answer'){
						await that.onRemoteAnswer(e['data']['userId'],e['data']['answer'])
					}
					if(e['type'] === 'candidate'){
						that.onCandiDate(e['data']['userId'],e['data']['candidate'])
					}
				})
				this.linkSocket.on("error",(e)=>{
					console.log("error",e)
				})
			},
			
			onCandiDate(fromUid,candidate){
				const localUid = this.formInline.userId
				let pcKey = localUid+'-'+fromUid
				let pc = RtcPcMaps.get(pcKey)
				//candidate 是一个 ICE 候选者对象，包含了网络地址和相关的通信信息。
				pc.addIceCandidate(candidate)
			},
			async initMeetingRoomPc(){
				const that = this
				//如果是caller即
				if(that.formInline.pub === 'pub'){
					this.localStream = await this.getLocalUserMedia();
					this.setDomVideoStream("localdemo01",this.localStream);
				}
				const localUid = this.formInline.userId
				//找到当前房间的视频流发布者 即主播
				let publisher = this.roomUserList.filter(e => e.userId !== localUid && e.pub === 'pub').map((e,index) =>{return e.userId})
				if(publisher.length >0){
					publisher = publisher[0]
					this.publisher = publisher
				}else{
					//如果是caller，这里就截断了，不会再往下走
					//这样就是一个完整的思路了
					return;
				}
				//和发布者建立RTC连接 不发送自己视频流
				let pcKey = localUid+'-'+publisher
				console.log("--pcKey--",pcKey);
				//先获取，如果没有再创建
				let pc = RtcPcMaps.get(pcKey)
				if(!pc){
					pc = new PeerConnection(that.rtcPcParams)
					RtcPcMaps.set(pcKey,pc)
				}

				/** 
				 * pc.addTrack() 更加直接且简单，适用于已有媒体轨道的情况。
				 * 一旦轨道被添加到 PeerConnection，它将保持不变，除非手动删除。
				 * 而 pc.addTransceiver() 允许在连接过程中动态管理轨道，可以根据需要添加、删除或修改传输器和媒体轨道
				 * 这部分是为了观众端能接收到媒体流
				 */
				// sendrecv 既发送也接受对方媒体 sendonly 仅发送不接受 recvonly 仅接受 不发送 如何不设置 则不发送也不接受
				pc.addTransceiver("audio", {direction: "recvonly"});
				pc.addTransceiver("video", {direction: "recvonly"});
				//先设立监听
				that.onPcEvent(pc,localUid,publisher)
				//创建数据通道
				await this.createDataChannel(pc,localUid,publisher)
				//创建offer
				let offer = await pc.createOffer();
				//设置offer未本地描述
				await pc.setLocalDescription(offer)
				//发送offer给被呼叫端
				let params = {"targetUid":publisher,"userId":localUid,"offer":offer}
				that.linkSocket.emit("offer",params)
			},
			/**
			 * 获取设备 stream
			 * @returns {Promise<MediaStream>}
			 */
			async getLocalUserMedia(){
				const audioId = this.formInline.audioInId
				const videoId = this.formInline.videoId
				const constraints = {
				    audio: {deviceId: audioId ? {exact: audioId} : undefined},
				    video: {
				        deviceId: videoId ? {exact: videoId} : undefined,
				        width:768,
				        height:480,
				        frameRate: { ideal: 15, max: 24 }
				    }
				};
				if (window.stream) {
				    window.stream.getTracks().forEach(track => {
				        track.stop();
				    });
				}
			    return await navigator.mediaDevices.getUserMedia(constraints).catch(handleError)
			},
			onPcEvent(pc,localUid,remoteUid){
				const that = this
				pc.ontrack = function(event) {
					console.log("监听到主播视频流",event)
					that.setDomVideoTrick('publisherVideo',event.track)
				};
				//PC event
				pc.ondatachannel = function(ev) {
				  console.log('用户：'+remoteUid+' 数据通道创建成功');
				  ev.channel.onopen = function() {
					console.log('用户：'+remoteUid+' 数据通道打开');
				  };
				  ev.channel.onmessage = function(data) {
					console.log('用户：'+remoteUid+' 数据通道消息',data.data);
					// 弹幕上屏幕
					that.onAllMessage(data.data)
				  };
				  ev.channel.onclose = function() {
					console.log('用户：'+remoteUid+' 数据通道关闭');
				  };
				};
				pc.onicecandidate = (event) => {
				  if (event.candidate) {
					that.linkSocket.emit('candidate',{'targetUid':remoteUid,"userId":localUid,"candidate":event.candidate})
				  } else {
				    /* 在此次协商中，没有更多的候选了 */
					console.log("在此次协商中，没有更多的候选了")
				  }
				}
			},
			/**
			 * 创建数据通道
			 * @param {Object} pc
			 * @param {Object} localUid
			 * @param {Object} remoteUid
			 */
			async createDataChannel(pc,localUid,remoteUid){
				let datachannel = await pc.createDataChannel(localUid+'-'+remoteUid);
				console.log("datachannel "+localUid+'-'+remoteUid,datachannel)
				dataChannelMap.delete(localUid+'-'+remoteUid)
				dataChannelMap.set(localUid+'-'+remoteUid,datachannel)
			},
			/**
			 * 指定数据通道发送数据
			 * @param {Object} uid
			 * @param {Object} remoteId
			 * @param {Object} msg
			 */
			clientDataChannelMsg(uid,remoteId,msg){
				let c = dataChannelMap.get(uid+'-'+remoteId)
				if(c){
					c.send(msg)
				}
			},
			/**
			 * 发布弹幕
			 */
			sendMsgToPub(msg=undefined){
				if(!msg){
					msg = this.message
				}
				//如果是主播 则遍历所有数据通道给每个客户端发送消息
				if(this.formInline.pub === 'pub'){
					dataChannelMap.forEach((index,k) => {
						dataChannelMap.get(k).send(msg)
					})
					this.danmuForRoller(msg)//上屏幕
				}else{
					//私信给主播 主播收到再广播（所以无需自己上屏幕）
					this.clientDataChannelMsg(this.formInline.userId,this.publisher,msg)
				}
				this.message = undefined
			},
			onAllMessage(msg){
				this.danmuForRoller(msg) //收到消息上屏幕
				//主播收到客户端的消息 广播 
				if(this.formInline.pub === 'pub'){
					dataChannelMap.forEach((index,k) => {
						dataChannelMap.get(k).send(msg)
					})
				}
			},
			/**
			 * 直播留言弹幕
			 * @param {Object} msg
			 */
			danmuForRoller(msg){
				if(this.danmaku){
					this.danmaku.emit({text: msg, style: {fontSize: '20px',color: '#ff5500'}})
				}
			},
			async onRemoteOffer(fromUid,offer){
				const localUid = this.formInline.userId
				let pcKey = localUid+'-'+fromUid
				//这个是publisher维护的PC
				let pc = new PeerConnection(this.rtcPcParams)
				RtcPcMaps.set(pcKey,pc)
				console.log("主播监听到远端offer");
				//先设立监听
				this.onPcEvent(pc,localUid,fromUid)
				//NOTE: 主播端创建数据通道,这个后期用来通信
				await this.createDataChannel(pc,localUid,fromUid)
				for (const track of this.localStream.getTracks()) {
				    pc.addTrack(track);
				}
				pc.setRemoteDescription(offer)
				let answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				let params = {"targetUid":fromUid,"userId":localUid,"answer":answer}
				this.linkSocket.emit("answer",params)
			},
			async onRemoteAnswer(fromUid,answer){
				const localUid = this.formInline.userId
				let pcKey = localUid+'-'+fromUid
				let pc = RtcPcMaps.get(pcKey)
				await pc.setRemoteDescription(answer);
			},
			changeMedia(){
				console.log(RtcPcMaps);
			},
			audioControl(b){
				this.localStream.getAudioTracks()[0].enabled = b
				this.mediaStatus.audio = b
			},
			videoControl(b){
				this.localStream.getVideoTracks()[0].enabled = b
				this.mediaStatus.video = b
			},
			getPs(){
				console.log(RtcPcMaps)
			}
		},
		watch: {
		    
		  }
		
	}
</script>

<style scoped>
	html,body{
		margin: 0;
		padding: 0;
	}
	
	.container{
		margin: 20px 0 20px 0;
		padding: 0;
		width: 98%;
		height: 90vh;
	}
	/* 所有流 */
	#allVideo{
		padding: 5px;
		height: auto;
		/* position: relative;
		display: flex;flex-direction: row;justify-content: flex-start;flex-wrap: wrap; */
	}
	/* 主播端浮窗 */
	#localDomId{
		/* border: 1px red solid; */
		display: flex;
		flex-direction: row;
		
	}
	
	.frame-videos{
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
		justify-content: flex-start;
		padding: 30px;
	}
	.frame-videos div{
		border: 1px blueviolet solid;
		width: 23%;
		height: 200px;
		position: relative;
		background-color: black;
	}
	.frame-videos div label{
		color: white;
		position: absolute;
		bottom: 2px;
		left: 2px;
	}
	.dialog-inner-container{
		margin-left:35%;
		margin-top: 5%;
	}
</style>