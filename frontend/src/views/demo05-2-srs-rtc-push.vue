<template>
	<div class="container">
		<el-row >
			<el-col :span="12" style="">
				<video id="videoElement" style="object-fit: fill;" controls width="700px" height="450px"></video>
				<el-row style="display: flex;flex-direction: column;justify-content: center;align-items: center;height: auto">
					<el-tag style="width: 600px;">当前流ID {{streamId}}</el-tag>
					<el-tag style="width: 600px;" type="warning" v-if="scanUrlFlv">FLV地址：{{scanUrlFlv}}</el-tag>
					<el-tag style="width: 600px;" type="danger" v-if="scanUrlHls">HLS地址：{{scanUrlHls}}</el-tag>
					<div>
						<el-button type="success" style="width: 100px;" size="mini" @click="play()">推流</el-button>
						<el-button type="danger" v-if="!audioStatus" style="width: 100px;" size="mini" @click="audioControl(true)">打开麦克风</el-button>
						<el-button type="primary" v-if="audioStatus" style="width: 100px;" size="mini" @click="audioControl(false)">关闭麦克风</el-button>
						<el-button type="danger" v-if="!videoStatus" style="width: 100px;" size="mini" @click="videoControl(true)">打开摄像头</el-button>
						<el-button type="primary" v-if="videoStatus" style="width: 100px;" size="mini" @click="videoControl(false)">关闭摄像头</el-button>
						<el-button type="primary" v-if="!shareStatus" style="width: 100px;" size="mini" @click="changeVideo()">屏幕分享</el-button>
						<el-button type="danger" v-if="shareStatus" style="width: 100px;" size="mini" @click="stopShare()">停止分享</el-button>
					</div>
				</el-row>
			</el-col>
			<el-col :span="10" style="margin-left: 30px;">
				<div style="font-size: 24px;font-weight: bolder;width: 50%;text-align: left;color: #409eff;">
					<label >直播预览</label>
				</div>
				<SrsRtcPull scanvideodomId="srsRtcPullPreview"  ref="srsRtcPullPreview" style="width: 50%;"></SrsRtcPull>
				<div style="font-size: 24px;font-weight: bolder;width: 50%;text-align: left;color: #409eff;">
					<label >连麦客户端</label>
				</div>
				<SrsRtcPull scanvideodomId="srsRtcPullApplyMic" ref="srsRtcPullApplyMic" style="width: 50%;"></SrsRtcPull>
			</el-col>
		</el-row>
		
	</div>
</template>

<script>
import SrsRtcPull from '@/components/SrsRtcPull'

navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;
var PeerConnection = window.RTCPeerConnection ||
    window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection;

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
    console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}
import axios from "axios"
const { io } = require("socket.io-client");
export default {
  name: 'srs-rtc-push',
  components: {
    SrsRtcPull
  },
  data(){
	  return{
		  flv:'',
		  pc:undefined,
		  localstream:undefined,
		  streamId:'localStream-'+Date.now(),
		  scanUrlFlv:undefined,
		  scanUrlHls:undefined,
		  videoStatus:true,
		  audioStatus:true,
		  shareStatus:false,
	  }
  },
  created() {
	  if(getParams("userId")){
		//初始化
	  	this.init(getParams("userId"),getParams("roomId"),getParams('userId'))
	  }
  },
  methods:{
	  //连接socket服务器
	  init(userId,roomId,nickname){
	  	const that = this
	  	this.userInfo = {
	  		userId:userId,
	  		roomId:roomId,
	  		nickname:nickname
	  	}
	  	this.linkSocket = io(this.$serverSocketUrl, {
	  		reconnectionDelayMax: 10000,
	  		transports: ["websocket"],
	  		query: {
	  		  "userId": userId,
	  		  "roomId": roomId,
	  		  "nickname":nickname
	  		}
	  	});
	  	this.linkSocket.on("connect",(e)=>{
	  		console.log("server init connect success",that.linkSocket)
	  	})
	  	this.linkSocket.on("roomUserList",(e)=>{
	  		console.log("roomUserList",e)
	  		that.roomUserList = e					
	  	})
		
	  	this.linkSocket.on("msg",async (e)=>{
	  		console.log("msg",e)
			//如果收到消息的时候如何处理
	  		if(e['type'] === 'applyMic'){
				//自动同意
				let params ={	"userId": getParams('userId'),"targetUid":e.data.userId}
				that.linkSocket.emit('acceptApplyMic',params)
				let remoteStreamId = e.data.streamId
				that.$refs['srsRtcPullApplyMic'].getPullSdp(remoteStreamId)
	  		}
	  	})
	  	this.linkSocket.on("error",(e)=>{
	  		console.log("error",e)
	  	})
	   },
	   //推流方法
	   async play(){
		   if(!this.localstream){
			   this.localstream = await this.getLocalUserMedia(null,null)
		   }
		   //拿到localstream去操作
		   await this.setDomVideoStream('videoElement',this.localstream)
		   //推流
		   await this.getPushSdp(this.streamId,this.localstream)
	   },


	   async setDomVideoStream(domId,newStream){
			let video = document.getElementById(domId)
			let stream = video.srcObject
			//如果之前有就先刷新删除重新加
			if(stream){
				stream.getTracks().forEach(e => e.stop())
			}
			video.srcObject =newStream
			video.muted = true
			video.autoplay=true
	   },


	   async getLocalUserMedia(audioId,videoId){
	   	const constraints = {
	   	    audio: {deviceId: audioId ? {exact: audioId} : undefined},
	   	    video: {
	   	        deviceId: videoId ? {exact: videoId} : undefined,
	   	        width:1920,
	   	        height:1080,
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
	   //推流
	   //sdp是会话描述协议的意思
	   async getPushSdp(streamId,stream){
			const that = this
			//创建pc
			that.pc = await new PeerConnection(null);
			
			//通过指定传输通道的方向，可以灵活地控制音频和视频在WebRTC连接中的传输行为。
			//在这种情况下，代码表明创建的PeerConnection对象只用于将音频和视频数据发送给对等端，
			//而不接收任何音频或视频数据。
			//是一种对对方说明状态的行为
			that.pc.addTransceiver("audio", {direction: "sendonly"});
			that.pc.addTransceiver("video", {direction: "sendonly"});
			//总之，getTracks()方法用于获取MediaStream对象中的所有轨道，
			//而addTrack()方法用于将轨道添加到PeerConnection中，确保在建立连接后能够传输相应的音频和视频数据。
			stream.getTracks().forEach(function (track) {
				that.pc.addTrack(track);
			});
			//然后写个offer
			let offer = await that.pc.createOffer();
			//加上本地描述
			await that.pc.setLocalDescription(offer)

			//send
			//需要一个Api接口，
			let data = {
			  "api": this.$srsServerAPIURL+"rtc/v1/publish/",
			  "streamurl": this.$srsServerRTCURL+streamId,
			  "sdp": offer.sdp
			}
			
			axios.post(this.$srsServerAPIURL+'rtc/v1/publish/',data)
			.then( async res => {
				res = res.data
				console.log(res)
				if(res.code === 0){
					//接到远端消息的时候
					await that.pc.setRemoteDescription(new RTCSessionDescription({type: 'answer', sdp: res.sdp}))
					//按照给是组装flv和hls点播地址 （SRS官网指定格式）
					that.scanUrlFlv = that.$srsServerFlvURL+streamId+'.flv'
					that.scanUrlHls = that.$srsServerFlvURL+streamId+'.m3u8'
					//推流成功后直接webrtc拉流预览 如果拉流这个步骤还没学的话等学完下节课再看这里 
					that.preLive()
				}else{
					this.$message.error("推流失败请重试")
				}
			}).catch(err => {
				console.error("SRS 推流异常",err)
				this.$message.error("推流异常，请检查流媒体服务器")
			})
	   },

	   //推流
	   preLive(){
		   this.$refs['srsRtcPullPreview'].getPullSdp(this.streamId)
	   },

	   //视频控制
	   videoControl(b){
		   if(this.pc){
			  this.videoStatus = !this.videoStatus  
			  const senders = this.pc.getSenders();
			  const send = senders.find((s) => s.track.kind === 'video')
			  send.track.enabled = b 
		   }else{
			   this.$message.error("请先点击推流")
		   }
	   },

	   //音频控制
	   audioControl(b){
		   if(this.pc){
			   console.log(this.pc)
			   this.audioStatus = !this.audioStatus 
			  const senders = this.pc.getSenders();
			  const send = senders.find((s) => s.track.kind === 'audio')
			  //注意这里是send.轨道，sender也是个容器对象
			  send.track.enabled = b 
		   }else{
			   this.$message.error("请先点击推流")
		   }
	   },


	   //分享操作
	   async getShareMedia(){
	   	const constraints = {
	   		video:{width:1920,height:1080},
	   		audio:false
	   	};
		
	   	return await navigator.mediaDevices.getDisplayMedia(constraints).catch(handleError);
	   },


	   async changeVideo(){
		   //点击推流的时候会新建pc
		   if(!this.pc){
			   this.$message.error("请先点击推流")
			   return
		   }
		   //拿到分享流
		   this.shareStream = await this.getShareMedia()
		   //从stream容器中拿到video tracks
		   const [videoTrack] = this.shareStream.getVideoTracks();
		   //然后从pc中拿到发送者们
		   const senders = this.pc.getSenders();
		   //找到video发送
		   const send = senders.find((s) => s.track.kind === 'video')
		   //使用replace，切换轨道
		   send.replaceTrack(videoTrack)
		   this.shareStatus = true
	   },
	   stopShare(){
		   if(this.shareStream){
			   this.shareStream.getTracks().forEach(e => e.stop())
			   this.shareStream = undefined
			   this.shareStatus = false
			   const [videoTrack] = this.localstream.getVideoTracks();
			   const senders = this.pc.getSenders();
			   const send = senders.find((s) => s.track.kind === 'video')
			   send.replaceTrack(videoTrack)
		   }
	   },
	   
	  
  }
}
</script>

<style scoped>
	.container{
		padding-top: 20px;
		height: 90vh;
	}
	
</style>