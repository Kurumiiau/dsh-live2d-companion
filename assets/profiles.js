/* DeepSeek arm motion sampling adapted from the local blog companion. */
const deepSeekMotionBase = new URL('/dsh-live2d/model/Animation/',location.href).href;
window.SonnetDeepSeek = function({getState,getFocus}) {
  let core=null,raw=null,speech=null,opening=0,frames=0,nosePart=-1;
  let curves={},channels=[],values={},defaults={},currentAction='idle',started=0,head=[0,0];
  const motionFiles={grass:'狗尾草切换出来.motion3.json',raise:'默认手切举手.motion3.json',point:'竖手指切出来动画.motion3.json'};
  function write(id,value){const i=raw?.parameters.ids.indexOf(id);if(i>=0)core.setParameterValueById(id,Math.max(raw.parameters.minimumValues[i],Math.min(raw.parameters.maximumValues[i],value)));}
  function parse(curve){
    const input=curve.Segments,segments=[];let t=input[0],v=input[1],i=2;
    while(i<input.length){const type=input[i++];
      if(type===1){const a={t:input[i++],v:input[i++]},b={t:input[i++],v:input[i++]},end={t:input[i++],v:input[i++]};segments.push({type,t,v,a,b,end});t=end.t;v=end.v;}
      else{const end={t:input[i++],v:input[i++]};segments.push({type,t,v,end});t=end.t;v=end.v;}
    }
    return {first:input[1],segments};
  }
  const cubic=(a,b,c,d,u)=>{const q=1-u;return q*q*q*a+3*q*q*u*b+3*q*u*u*c+u*u*u*d;};
  function sample(curve,time){
    for(const s of curve.segments){if(time>s.end.t)continue;
      if(time<=s.t)return s.v;
      if(s.type===2)return s.v;if(s.type===3)return s.end.v;
      if(s.type===0)return s.v+(s.end.v-s.v)*(time-s.t)/(s.end.t-s.t||1);
      let lo=0,hi=1;for(let i=0;i<14;i++){const u=(lo+hi)/2;if(cubic(s.t,s.a.t,s.b.t,s.end.t,u)<time)lo=u;else hi=u;}
      return cubic(s.v,s.a.v,s.b.v,s.end.v,(lo+hi)/2);
    }
    return curve.segments.at(-1)?.end.v??curve.first;
  }
  return {
    async attach(model){
      core=model.internalModel.coreModel;raw=core.getModel();nosePart=raw.parts.ids.indexOf('Part46');
      await Promise.all(Object.entries(motionFiles).map(async([name,file])=>{
        const response=await fetch(new URL(file,deepSeekMotionBase));if(!response.ok)throw Error('动作文件加载失败：'+file);
        const motion=await response.json();curves[name]=Object.fromEntries(motion.Curves.filter(c=>c.Target==='Parameter').map(c=>[c.Id,parse(c)]));
      }));
      channels=[...new Set(Object.values(curves).flatMap(c=>Object.keys(c)))];
      for(const id of channels){const i=raw.parameters.ids.indexOf(id);if(i>=0)values[id]=defaults[id]=raw.parameters.defaultValues[i];}
    },
    startSpeech(text,duration){speech={start:performance.now(),duration:Math.min(duration-300,Math.max(1000,Array.from(text).length*130))};},
    applyInputs(_core,delta){
      // VTube Studio maps face/body tracking to these custom INPUT parameters;
      // the model's native physics then produces ParamAngle*/ParamBodyAngle*.
      const focus=getState().follow?getFocus?.():null,blend=1-Math.exp(-Math.min(delta,.1)*10);
      head[0]+=((focus?.x||0)-head[0])*blend;head[1]+=((focus?.y||0)-head[1])*blend;
      write('AngleX',head[0]*30);write('AngleY',head[1]*30);write('AngleZ',-head[0]*10);
      write('PositionX',head[0]*22);write('PositionY',head[1]*18);write('PositionZ',-head[0]*12);
      write('JawOpen',opening);
    },
    apply(_core,delta){
      if(nosePart>=0)raw.parts.opacities[nosePart]=0;
      const action=getState().action,now=performance.now(),blend=1-Math.exp(-Math.min(delta,.1)*22);
      if(action!==currentAction){currentAction=action;started=now;}
      const time=(now-started)/1000,selected=curves[action]||{};
      for(const id of channels){const target=selected[id]?sample(selected[id],time):defaults[id];values[id]+=(target-values[id])*blend;write(id,values[id]);}
      if(speech&&now-speech.start>=speech.duration)speech=null;
      const targetMouth=speech?Math.max(0,Math.sin((now-speech.start)*.024))*.36:0;
      opening+=(targetMouth-opening)*blend;if(!speech&&opening<.002)opening=0;write('ParamMouthOpenY',opening);if(speech)frames++;
    },
    pause(){speech=null;opening=0;if(core)write('ParamMouthOpenY',0);},
    reset(){speech=null;opening=0;currentAction='idle';for(const id of channels)values[id]=defaults[id];head=[0,0];},
    status:()=>({character:'deepseek',noseFix:true,nosePart,fullMotionChannels:channels.length,tracking:[...head],speech:{active:!!speech,opening:+opening.toFixed(3),frames},pose:[1,2,3].map(i=>values['Movement'+i]||0)})
  };
};
