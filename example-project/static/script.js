// =============================================
// NEXUS UI - Interactive Script
// =============================================
(function initParticles() {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [], mouse = { x: null, y: null };
    const COUNT = 80, DIST = 120, COLORS = ['#6366f1','#8b5cf6','#a855f7','#3b82f6','#ec4899'];
    function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
    resize(); addEventListener('resize', resize);
    addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    class P {
        constructor() { this.r(); }
        r() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.vx = (Math.random()-0.5)*0.8; this.vy = (Math.random()-0.5)*0.8; this.rad = Math.random()*2.5+1; this.color = COLORS[Math.floor(Math.random()*COLORS.length)]; this.a = Math.random()*0.5+0.2; }
        u() { this.x += this.vx; this.y += this.vy; if(this.x<0||this.x>canvas.width) this.vx*=-1; if(this.y<0||this.y>canvas.height) this.vy*=-1; if(mouse.x!==null){const dx=mouse.x-this.x,dy=mouse.y-this.y,d=Math.sqrt(dx*dx+dy*dy);if(d<200){this.x-=dx*0.005;this.y-=dy*0.005;}} }
        d() { ctx.beginPath(); ctx.arc(this.x,this.y,this.rad,0,Math.PI*2); ctx.fillStyle=this.color; ctx.globalAlpha=this.a; ctx.fill(); ctx.globalAlpha=1; }
    }
    for(let i=0;i<COUNT;i++) particles.push(new P());
    function animate() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        particles.forEach(p=>{p.u();p.d();});
        for(let i=0;i<particles.length;i++){for(let j=i+1;j<particles.length;j++){const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<DIST){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle='rgba(99,102,241,'+(0.15*(1-d/DIST))+')';ctx.lineWidth=0.5;ctx.stroke();}}if(mouse.x!==null){const dx=particles[i].x-mouse.x,dy=particles[i].y-mouse.y,d=Math.sqrt(dx*dx+dy*dy);if(d<DIST){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(mouse.x,mouse.y);ctx.strokeStyle='rgba(168,85,247,'+(0.3*(1-d/DIST))+')';ctx.lineWidth=1;ctx.stroke();}}}
        requestAnimationFrame(animate);
    }
    animate();
})();

function showToast(msg, type='info') {
    const c = document.getElementById('toastContainer'); if(!c) return;
    const t = document.createElement('div'); t.className = 'toast '+type;
    const icons = {success:'\u2705',error:'\u274C',info:'\u2139\uFE0F'};
    t.innerHTML = '<span>'+(icons[type]||'')+'</span><span>'+msg+'</span>';
    c.appendChild(t);
    setTimeout(()=>{t.style.animation='toastOut 0.4s forwards';setTimeout(()=>t.remove(),400);},3500);
}

function togglePassword(id) {
    const input = document.getElementById(id||'password'); if(!input) return;
    const g = input.closest('.input-group');
    const eo = g.querySelector('.eye-open'), ec = g.querySelector('.eye-closed');
    if(input.type==='password'){input.type='text';if(eo)eo.style.display='none';if(ec)ec.style.display='inline';}
    else{input.type='password';if(eo)eo.style.display='inline';if(ec)ec.style.display='none';}
}

const pwInput = document.getElementById('password');
const sBar = document.getElementById('strengthBar');
if(pwInput&&sBar){pwInput.addEventListener('input',function(){const v=this.value;let s=0;if(v.length>=6)s++;if(v.length>=10)s++;if(/[A-Z]/.test(v)&&/[0-9]/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;sBar.className='password-strength';if(v.length===0){}else if(s<=1)sBar.classList.add('strength-weak');else if(s<=2)sBar.classList.add('strength-medium');else sBar.classList.add('strength-strong');});}

const cInput = document.getElementById('confirm_password');
const mInd = document.getElementById('matchIndicator');
if(cInput&&mInd){cInput.addEventListener('input',function(){const pw=document.getElementById('password');if(pw&&this.value.length>0){if(this.value===pw.value){mInd.textContent='\u2705';mInd.classList.add('show');}else{mInd.textContent='\u274C';mInd.classList.add('show');}}else mInd.classList.remove('show');});}

document.querySelectorAll('.auth-form').forEach(f=>{f.addEventListener('submit',function(){const b=this.querySelector('.btn-primary');if(b){const txt=b.querySelector('.btn-text'),ld=b.querySelector('.btn-loader');if(txt)txt.style.display='none';if(ld)ld.style.display='inline-flex';b.disabled=true;b.style.opacity='0.7';}});});

function animateCounters(){document.querySelectorAll('[data-count]').forEach(el=>{const target=parseInt(el.dataset.count),prefix=el.dataset.prefix||'',dur=2000,start=performance.now();function u(now){const p=Math.min((now-start)/dur,1),eased=1-Math.pow(1-p,3),cur=Math.floor(eased*target);el.textContent=prefix+cur.toLocaleString();if(p<1)requestAnimationFrame(u);}requestAnimationFrame(u);});}

function drawChart(){const canvas=document.getElementById('activityChart');if(!canvas)return;const ctx=canvas.getContext('2d'),rect=canvas.parentElement.getBoundingClientRect();canvas.width=rect.width;canvas.height=rect.height;const data=[30,55,40,75,60,85,50],labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],max=Math.max(...data)*1.2,w=canvas.width,h=canvas.height,pad={t:20,r:20,b:30,l:40},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(100,100,255,0.06)';ctx.lineWidth=1;for(let i=0;i<=4;i++){const y=pad.t+(ch/4)*i;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}const pts=data.map((v,i)=>({x:pad.l+(cw/(data.length-1))*i,y:pad.t+ch-(v/max)*ch}));const grad=ctx.createLinearGradient(0,pad.t,0,h);grad.addColorStop(0,'rgba(99,102,241,0.3)');grad.addColorStop(1,'rgba(99,102,241,0)');ctx.beginPath();ctx.moveTo(pts[0].x,h-pad.b);pts.forEach((p,i)=>{if(i===0){ctx.lineTo(p.x,p.y);return;}const prev=pts[i-1],c1=prev.x+(p.x-prev.x)/3,c2=p.x-(p.x-prev.x)/3;ctx.bezierCurveTo(c1,prev.y,c2,p.y,p.x,p.y);});ctx.lineTo(pts[pts.length-1].x,h-pad.b);ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.beginPath();pts.forEach((p,i)=>{if(i===0){ctx.moveTo(p.x,p.y);return;}const prev=pts[i-1],c1=prev.x+(p.x-prev.x)/3,c2=p.x-(p.x-prev.x)/3;ctx.bezierCurveTo(c1,prev.y,c2,p.y,p.x,p.y);});ctx.strokeStyle='#6366f1';ctx.lineWidth=2.5;ctx.stroke();pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle='#6366f1';ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle='#0d0d2b';ctx.fill();});ctx.fillStyle='#555588';ctx.font='11px Inter,sans-serif';ctx.textAlign='center';pts.forEach((p,i)=>{ctx.fillText(labels[i],p.x,h-8);});}

function toggleSidebar(){const s=document.getElementById('sidebar');if(s)s.classList.toggle('open');}

document.querySelectorAll('.chart-tab').forEach(t=>{t.addEventListener('click',function(){document.querySelectorAll('.chart-tab').forEach(x=>x.classList.remove('active'));this.classList.add('active');drawChart();});});

window.addEventListener('DOMContentLoaded',()=>{setTimeout(animateCounters,600);setTimeout(drawChart,200);addEventListener('resize',drawChart);const g=document.querySelector('.page-title');if(g)showToast('Welcome! You are logged in.','success');});
