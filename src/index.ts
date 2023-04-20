import { Context, Schema,segment,h } from 'koishi'
import https from 'https'
// const https = require('https')
export const name = 'bilibili-live-monitor'

export interface Config {
  account:string,
  plantform:string,
  sendINFO:any,
}

export const Config: Schema<Config> = Schema.object({
  account: Schema.string().description("账号(qq号)"),
  plantform: Schema.string().default("onebot").description("账号平台"),
  sendINFO:Schema.array(Schema.object({
    sendAll:Schema.boolean().default(true).description("@全体"),
    roomeID: Schema.string().description("直播间房间号"),
    groupID: Schema.string().description("需要发送的群组"),
    
    welcomeTextList:Schema.array(Schema.string()).description("开播提醒语句"),
    sendBye:Schema.boolean().default(true).description("是否发送结束语句(有概率抽风)"),
    byeTextList:Schema.array(Schema.string()).description("结束提醒语句"),
  })).description("监听&发送配置"),


})



export function apply(ctx: Context,config: Config) {
  for(let i=0;i<config.sendINFO.length;i++){
    let singleConfig = config.sendINFO[i];
    let bilibiliLiveInfo = {
      "roomeID":singleConfig.roomeID,
      "title":'',
      "user_cover":'',
      "live_status":'0', //默认未开播
      "live_time":'', //上次直播时间
      "welcomeTextList":singleConfig.welcomeTextList,
      "sendBye":singleConfig.sendBye,
      "byeTextList":singleConfig.byeTextList,
      "groupID":singleConfig.groupID,
    }
    ctx.setInterval(function() {
      getRoomInfo(ctx.bots[`${config.plantform}:${config.account}`],bilibiliLiveInfo.roomeID,bilibiliLiveInfo,singleConfig)
    },10000);
  }

  }
 


export function getRoomInfo(bot,room_id,bilibiliLiveInfo,config): any {
  var roomInfo = {
    "title":'',
    "user_cover":'',
    "live_time":'',
    "live_status":'0' //默认未开播
  }
  const url = `https://api.live.bilibili.com/room/v1/Room/get_info?room_id=`+room_id
  https.get(url, res => {
    let body = ''

    res.on('data', (chunk) => {
      body += chunk
    })

    res.on('end', () => {
      try {
        let returnData = JSON.parse(body);
        roomInfo.title = returnData.data.title;
        roomInfo.user_cover = returnData.data.user_cover;
        roomInfo.live_status = returnData.data.live_status;
        roomInfo.live_time = returnData.data.live_time;
        analysisRoomInfo(bot,room_id, roomInfo,bilibiliLiveInfo,config)
      } catch (error) {
        console.error(error.message)
      }
    })
  }).on('error', (e) => {
    console.error(e)
  })
}
function analysisRoomInfo(bot,room_id, roomInfo,bilibiliLiveInfo,config){
  //roomInfo 实时查到的房间信息
  //bilibiliLiveInfo 上次查到的房间信息
  // console.log(roomInfo.live_status != bilibiliLiveInfo.live_status)
  if(roomInfo.live_status != bilibiliLiveInfo.live_status){
    if(roomInfo.live_status == '1'){
      bilibiliLiveInfo.live_status = roomInfo.live_status;
      bilibiliLiveInfo.title = roomInfo.title;
      bilibiliLiveInfo.user_cover = roomInfo.user_cover;
      bilibiliLiveInfo.live_time = roomInfo.live_time;
      
      let message = "";
      if(config.sendAll){
        message += h('at', { type: "all" }) + "\n";
      }
      message += getRandomListStr(bilibiliLiveInfo.welcomeTextList)+'\n';
      
      message += bilibiliLiveInfo.title + "\n";
      message += 'https://live.bilibili.com/'+room_id+segment.image(roomInfo.user_cover);
      
      bot.sendMessage(bilibiliLiveInfo.groupID,message)
    }else if(roomInfo.live_status == '0' && bilibiliLiveInfo.sendBye){
      bilibiliLiveInfo.live_status = roomInfo.live_status;
      var timeDiffStr = timeDiff(bilibiliLiveInfo.live_time);
      if(timeDiffStr !== null){
          bot.sendMessage(bilibiliLiveInfo.groupID, getRandomListStr(bilibiliLiveInfo.byeTextList) + timeDiffStr);
      }
    }
  }

}
// 计算历史事件到当前时间时间差
function timeDiff(old){
  let dateBegin = new Date(old.replace(/-/g, "/"));//将-转化为/，使用new Date
  let dateEnd = new Date();//获取当前时间
  let dateDiff = dateEnd.getTime() - dateBegin.getTime();//时间差的毫秒数
  let dayDiff = Math.floor(dateDiff / (24 * 3600 * 1000));//计算出相差天数
  let leave1=dateDiff%(24*3600*1000) //计算天数后剩余的毫秒数
  let hours=Math.floor(leave1/(3600*1000))//计算出小时数
  //计算相差分钟数
  let leave2=leave1%(3600*1000) //计算小时数后剩余的毫秒数
  let minutes=Math.floor(leave2/(60*1000))//计算相差分钟数
  //计算相差秒数
  let leave3=leave2%(60*1000) //计算分钟数后剩余的毫秒数
  let seconds=Math.round(leave3/1000)
  if(Number.isNaN(seconds) || Number.isNaN(minutes) || Number.isNaN(hours)){
    return null;
  }
  return("这次直播了 "+hours+"小时 "+minutes+" 分钟"+seconds+" 秒")
}
function randomListIndex(arr){
  return Math.floor(Math.random()*arr.length)
}
function getRandomListStr(arr){
  if(arr.length == 0){
    return "";
  }
  return arr[randomListIndex(arr)]
}