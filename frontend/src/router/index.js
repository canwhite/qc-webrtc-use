import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)


let routes =  [
	{
	  path: '/',
	  name: 'home',
	  component: () => import("@/views/home"),
	},
	{
	  path: '/demo01',
	  name: 'demo01',
	  component: () => import("@/views/demo01-base"),
	},
	{
	  path: '/demo02',
	  name: 'demo02',
	  component: () => import("@/views/demo02-share"),
	},
	{
	  path: '/virtualbg',
	  name: 'virtualbg',
	  component: () => import("@/views/virtualbg"),
	},
	{
	  path: '/demo03-one2one',
	  name: 'demo03-one2one',
	  component: () => import("@/views/demo03-1-one2one"),
	},
	{
	  path: '/demo03-one2many',
	  name: 'demo03-one2many',
	  component: () => import("@/views/demo03-2-one2many"),
	},
	{
	  path: '/demo03-many2many',
	  name: 'demo03-many2many',
	  component: () => import("@/views/demo03-3-many2many"),
	},
	{
	  path: '/demo04-janus-01',
	  name: 'demo04-janus-01',
	  component: () => import("@/views/demo04-1-janus-p2p.vue"),
	},
	{
	  path: '/demo04-janus-02',
	  name: 'demo04-janus-02',
	  component: () => import("@/views/demo04-2-janus-many2many.vue"),
	},
	{
	  path: '/flv-player',
	  name: 'flv-player',
	  component: () => import("@/views/demo05-1-flv-player.vue"),
	},
	{
	  path: '/srs-rtc-push',
	  name: 'srs-rtc-push',
	  component: () => import("@/views/demo05-2-srs-rtc-push.vue"),
	},
	{
	  path: '/srs-live-room',
	  name: 'srs-live-room',
	  component: () => import("@/views/demo05-3-srs-live-room.vue"),
	},
	{
	  path: '/srs-meeting-room',
	  name: 'srs-meeting-room',
	  component: () => import("@/views/demo05-4-srs-meeting-room.vue"),
	},
	{
	  path: '/stream-merger-push',
	  name: 'stream-merger-push',
	  component: () => import("@/views/demo06-stream-merger-push.vue"),
	},
	
]


const router = new Router({
  mode: 'history', // 去掉url中的#
  scrollBehavior: () => ({ y: 0 }),
  routes: routes
  
})


export default router
