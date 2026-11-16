# Música original: pulso limpio y moderno, golpe suave y barrido en cada cambio de escena, subida antes del cierre.
import numpy as np, soundfile as sf, json
from scipy.signal import butter, sosfilt
SR=44100; T=43.6; N=int(SR*T); out=np.zeros((N,2)); rng=np.random.default_rng(7)
F=json.load(open('frases.json')); CORTES=[f[0]-.08 for f in F[1:]]+[T-.75]
def filt(x,f,t): return sosfilt(butter(2,f,t,fs=SR,output='sos'),x,axis=0)
def poner(s,t,g=1.0,pan=0.0):
    i=int(max(t,0)*SR)
    if i>=N: return
    s=s[:N-i]; out[i:i+len(s),0]+=s*g*(1-pan*.5); out[i:i+len(s),1]+=s*g*(1+pan*.5)
def env(n,a,d): e=np.ones(n); a=int(a*SR); d=int(d*SR); e[:a]=np.linspace(0,1,a); e[-d:]*=np.linspace(1,0,d); return e
BPM=104; B=60/BPM
acordes=[[220,261.6,329.6,392],[174.6,220,261.6,329.6],[130.8,196,261.6,329.6],[196,246.9,293.7,392]]
t=0;i=0
while t<T:
    d=B*8; n=int(d*SR); tt=np.arange(n)/SR
    s=sum(np.sin(2*np.pi*f*tt)+.35*np.sin(2*np.pi*f*2.005*tt)+.12*np.sin(2*np.pi*f*3.01*tt) for f in acordes[i%4])/8
    poner(s*env(n,.5,.9),t,.26)
    # bajo
    for j in range(8):
        nb=int(B*.9*SR); tb=np.arange(nb)/SR; f=acordes[i%4][0]/2
        poner(np.sin(2*np.pi*f*tb)*np.exp(-tb*5)*(.9 if j%2==0 else .5),t+j*B,.30)
    # arpegio
    for j in range(16):
        f=acordes[i%4][[0,2,1,3][j%4]]*2; na=int(.22*SR); ta=np.arange(na)/SR
        poner(np.sin(2*np.pi*f*ta)*np.exp(-ta*16),t+j*B/2,.07,pan=(-1)**j*.6)
    t+=d; i+=1
def kick():
    n=int(.32*SR); tt=np.arange(n)/SR; f=48+95*np.exp(-tt*32); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*10)
def hat(d=90):
    n=int(.05*SR); return filt(rng.standard_normal(n),7500,'high')*np.exp(-np.arange(n)/SR*d)
def clap():
    n=int(.16*SR); return filt(rng.standard_normal(n),[900,3500],'band')*np.exp(-np.arange(n)/SR*28)
t=0; k=0
while t<T-.8:
    lleno = t>=CORTES[2]  # desde que entra NXUS, ritmo completo
    poner(kick(),t,.5 if lleno else .34)
    poner(hat(),t+B/2,.10)
    if lleno:
        poner(hat(140),t+B/4,.05); poner(hat(140),t+3*B/4,.05)
        if k%2==1: poner(clap(),t,.16)
    t+=B; k+=1
for c in CORTES:
    n=int(.45*SR); w=filt(rng.standard_normal(n),[400,5000],'band')*np.linspace(0,1,n)**2.2
    poner(w,c-.42,.16); poner(kick(),c,.42)
    nn=int(.5*SR); tn=np.arange(nn)/SR; poner(np.sin(2*np.pi*1320*tn)*np.exp(-tn*9),c+.02,.035)
for c in (CORTES[2],CORTES[8]):
    n=int(1.4*SR); tt=np.arange(n)/SR; r=np.sin(2*np.pi*np.cumsum(220+700*tt/1.4)/SR)*(tt/1.4)**2
    poner(r,c-1.4,.07)
out=filt(out,38,'high'); f=int(.5*SR); out[-f:]*=np.linspace(1,.25,f)[:,None]; out[:int(.03*SR)]*=np.linspace(0,1,int(.03*SR))[:,None]
out/=np.max(np.abs(out))+1e-9; sf.write('musica.wav',out*.9,SR)
