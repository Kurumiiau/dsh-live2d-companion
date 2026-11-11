/* Natural attention: all timing uses the render clock, no extra timers or render loops. */
(function(root){
  function createNaturalAttention({clock=()=>performance.now(),hour=()=>new Date().getHours(),random=Math.random}={}){
    const range=(a,b)=>a+(b-a)*random(),ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
    let lastMove=clock(),lastX=null,lastY=null,nextBlink=lastMove+range(2200,5500),nextGlance=lastMove+range(6500,14000),nextSleep=lastMove+range(18000,36000);
    let blink=null,glance=null,sleep=null,wasEnabled=true;const counts={blinks:0,slowBlinks:0,glances:0,nods:0};
    function reset(){const t=clock();lastMove=t;blink=glance=sleep=null;nextBlink=t+range(2200,5500);nextGlance=t+range(6500,14000);nextSleep=t+range(18000,36000)}
    function pointerMoved(x,y){if(lastX!==null&&Math.hypot(x-lastX,y-lastY)<2)return;lastX=x;lastY=y;lastMove=clock();glance=sleep=null;if(blink?.slow){blink=null;nextBlink=lastMove+range(2200,5500)}nextGlance=lastMove+range(6500,14000);nextSleep=lastMove+range(18000,36000)}
    function beginBlink(t,slow){blink={start:t,close:slow?380:75,hold:slow?180:25,open:slow?650:135,slow};counts.blinks++;if(slow)counts.slowBlinks++}
    let output={openness:1,gazeX:0,gazeY:0,nod:0,night:false,glancing:false,drowsy:false,slowBlink:false};
    function step({x=0,y=0,enabled=true}={}){
      const t=clock(),h=hour(),night=h>=23||h<5;
      if(!enabled){if(wasEnabled)reset();wasEnabled=false;return output={openness:1,gazeX:0,gazeY:0,nod:0,night,glancing:false,drowsy:false,slowBlink:false}}
      if(!wasEnabled){reset();wasEnabled=true}
      if(!night&&sleep){sleep=null;if(blink?.slow)blink=null}
      const still=t-lastMove;
      if(night&&still>5000&&!sleep&&!blink&&t>=nextSleep){sleep={start:t,duration:2300};glance=null;beginBlink(t,true);counts.nods++;nextSleep=t+range(30000,60000);nextGlance=t+range(7500,16000)}
      if(!sleep&&!glance&&still>3000&&t>=nextGlance){const direction=Math.abs(x)>.25?-Math.sign(x):(random()<.5?-1:1);glance={start:t,duration:range(1800,2500),x:direction*range(.32,.5),y:range(-.1,.1)};counts.glances++;}
      if(!blink&&t>=nextBlink)beginBlink(t,false);
      let openness=1,slowBlink=false;
      if(blink){const elapsed=t-blink.start,total=blink.close+blink.hold+blink.open;slowBlink=blink.slow;if(elapsed<blink.close)openness=1-ease(elapsed/blink.close);else if(elapsed<blink.close+blink.hold)openness=0;else if(elapsed<total)openness=ease((elapsed-blink.close-blink.hold)/blink.open);else{blink=null;slowBlink=false;nextBlink=t+range(3000,6500)}}
      let gazeX=0,gazeY=0,nod=0;
      if(glance){const p=(t-glance.start)/glance.duration;if(p>=1){glance=null;nextGlance=t+range(7000,16000)}else{const weight=p<.22?ease(p/.22):p>.7?ease((1-p)/.3):1;gazeX=glance.x*weight;gazeY=glance.y*weight}}
      if(sleep){const p=(t-sleep.start)/sleep.duration;if(p>=1)sleep=null;else nod=-3.2*Math.pow(Math.sin(p*Math.PI),2)}
      return output={openness,gazeX,gazeY,nod,night,glancing:!!glance,drowsy:!!sleep,slowBlink};
    }
    return {step,pointerMoved,reset,status:()=>({...output,counts:{...counts},stationaryMS:clock()-lastMove})};
  }
  if(typeof module==='object'&&module.exports)module.exports=createNaturalAttention;
  else root.DSHNaturalAttention=createNaturalAttention;
})(typeof window==='object'?window:globalThis);
