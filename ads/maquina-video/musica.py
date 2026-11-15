# Música original: pulso suave de noche que se prende cuando la IA despierta, golpes en los cortes.
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
SR=44100; T=31.5; N=int(SR*T); out=np.zeros((N,2)); rng=np.random.default_rng(3)
def filt(x,f,t): return sosfilt(butter(2,f,t,fs=SR,output='sos'),x,axis=0)
def poner(s,t,g=1.0):
    i=int(t*SR)
    if i>=N: return
    s=s[:N-i]; s=np.stack([s,s],1) if s.ndim==1 else s; out[i:i+len(s)]+=s*g
def env(n,a,d): e=np.ones(n); a=int(a*SR); d=int(d*SR); e[:a]=np.linspace(0,1,a); e[-d:]*=np.linspace(1,0,d); return e
BPM=96; B=60/BPM
CORTES=[4.2,6.1,9.4,12.5,16.1,20.2,23.95,29.15]
# acordes (pad)
acordes=[[220,261.6,329.6],[174.6,220,261.6],[196,246.9,293.7],[164.8,207.7,246.9]]
t=0;i=0
while t<T:
    d=B*8; n=int(d*SR); tt=np.arange(n)/SR
    s=sum(np.sin(2*np.pi*f*tt)+.4*np.sin(2*np.pi*f*2.01*tt) for f in acordes[i%4])/6
    poner(s*env(n,.6,.8),t,.22); t+=d; i+=1
# pulso desde que la IA despierta
def kick():
    n=int(.35*SR); tt=np.arange(n)/SR; f=50+90*np.exp(-tt*30); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*9)
def hat():
    n=int(.04*SR); return filt(rng.standard_normal(n),7000,'high')*np.exp(-np.arange(n)/SR*90)
t=4.2
while t<T-1.2:
    poner(kick(),t,.55)
    poner(hat(),t+B/2,.12)
    if 6.1<t<23.9: poner(hat(),t+B/4*3,.06)
    t+=B
# golpes y woosh en cortes
for c in CORTES:
    n=int(.5*SR); w=filt(rng.standard_normal(n),[300,4000],'band')*np.linspace(0,1,n)**2
    poner(w,c-.5,.18); poner(kick(),c,.5)
# riser antes del cierre
n=int(1.6*SR); tt=np.arange(n)/SR; r=np.sin(2*np.pi*np.cumsum(200+600*tt/1.6)/SR)*(tt/1.6)**2
poner(r,23.95-1.6,.08)
out=filt(out,40,'high'); out/=np.max(np.abs(out))+1e-9
sf.write('musica.wav',out*.9,SR)
