/** Fit only an active conversation to the visible phone viewport. No media access. */
export class LearningMobileLayout {
  private attached=false;
  private frame:number|undefined;
  private readonly queue=()=>{
    if(this.frame!==undefined)cancelAnimationFrame(this.frame);
    this.frame=requestAnimationFrame(()=>{this.frame=undefined;this.measure();});
  };
  sync():void {
    if(typeof document==='undefined')return;
    if(!document.querySelector('.lab-conversation')){this.leave();return;}
    if(!this.attached){
      window.addEventListener('resize',this.queue);
      window.visualViewport?.addEventListener('resize',this.queue);
      window.visualViewport?.addEventListener('scroll',this.queue);
      document.addEventListener('focusin',this.queue);
      document.addEventListener('focusout',this.queue);
      this.attached=true;
    }
    this.measure();
  }
  private measure():void {
    const runner=document.querySelector<HTMLElement>('.lab-conversation');
    if(!runner)return;
    const viewport=window.visualViewport;
    const height=viewport?.height??window.innerHeight;
    const top=viewport?.offsetTop??0;
    const mobile=window.matchMedia('(max-width: 900px)').matches;
    const keyboard=mobile&&((viewport?.scale??1)===1)&&
      (window.innerHeight-height>120||(document.activeElement?.id==='lab-coach-message'&&height<520));
    document.documentElement.classList.toggle('learning-keyboard',keyboard);
    document.documentElement.classList.toggle('learning-conversation-open',mobile);
    const nav=document.querySelector<HTMLElement>('.mobile-nav');
    const navHeight=mobile&&!keyboard&&nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0;
    runner.style.setProperty('--chat-viewport-top',`${top}px`);
    const pageOffset=mobile?0:Math.max(0,runner.getBoundingClientRect().top-top)+12;
    runner.style.setProperty('--chat-viewport-height',`${Math.max(160,height-navHeight-pageOffset)}px`);
  }
  leave():void {
    if(typeof document==='undefined')return;
    if(this.frame!==undefined)cancelAnimationFrame(this.frame);
    this.frame=undefined;
    if(this.attached){
      window.removeEventListener('resize',this.queue);
      window.visualViewport?.removeEventListener('resize',this.queue);
      window.visualViewport?.removeEventListener('scroll',this.queue);
      document.removeEventListener('focusin',this.queue);
      document.removeEventListener('focusout',this.queue);
    }
    this.attached=false;
    document.documentElement.classList.remove('learning-keyboard','learning-conversation-open');
  }
}
