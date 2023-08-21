import Vue from 'vue'
import App from './App.vue'
import router from './router'

import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
Vue.config.productionTip = false
Vue.use(ElementUI)
const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
const host = window.location.host
const server = protocol+host
console.log("current server ",server);
console.log(process.env)

let serverSocketUrl = process.env.NODE_ENV === 'development' ? 'ws://127.0.0.1:18080' : server
//信令服务器
Vue.prototype.$serverSocketUrl = serverSocketUrl;


//SRS相关地址
Vue.prototype.$srsServerAPIURL = 'http://192.168.0.100:1985/';
Vue.prototype.$srsServerRTCURL = 'webrtc://192.168.0.100:8085/live/';
Vue.prototype.$srsServerFlvURL = 'http://192.168.0.100:8085/live/';

//Janus地址
Vue.prototype.$janusServerUrl = process.env.NODE_ENV === 'development' ? 'http://42.194.xxx.195:18088/janus' : '/suke-janus/janus/'

new Vue({
	router,
  render: h => h(App),
}).$mount('#app')
