# Música original en dos ánimos: tensa y con tic-tac mientras el día se sale de control; luminosa cuando entra la solución.
import numpy as np, soundfile as sf, json
from scipy.signal import butter, sosfilt
SR=44100; T=28.5; N=int(SR*T); out=np.zeros((N,2)); rng=np.random.default_rng(5)
F=json.load(open('frases.json')); S=[f[0] for f in F]; CAMBIO=S[4]-.12
P=json.load(open('palabras.json')); llegar=[w[0] for w in P if w[2].lower().startswith('llegar')][0]-.25
CORTES=[S[1]-.14,S[2]-.3,S[3]-.04,CAMBIO,S[6]-.3,llegar,S[7]-.3,T-.5]
def filt(x,f,t): return sosfilt(butter(2,f,t,fs=SR,output='sos'),x,axis=0)
def poner(s,t,g=1.0,pan=0.0):
    i=int(max(t,0)*SR)
    if i>=N: return
    s=s[:N-i]; out[i:i+len(s),0]+=s*g*(1-pan*.5); out[i:i+len(s),1]+=s*g*(1+pan*.5)
def env(n,a,d): e=np.ones(n); a=int(a*SR); d=int(d*SR); e[:a]=np.linspace(0,1,a); e[-d:]*=np.linspace(1,0,d); return e
def tono(f,d,dec): n=int(d*SR); tt=np.arange(n)/SR; return np.sin(2*np.pi*f*tt)*np.exp(-tt*dec)
def kick():
    n=int(.32*SR); tt=np.arange(n)/SR; f=48+95*np.exp(-tt*32); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*10)
def hat(d=90):
    n=int(.05*SR); return filt(rng.standard_normal(n),7500,'high')*np.exp(-np.arange(n)/SR*d)
def clap():
    n=int(.16*SR); return filt(rng.standard_normal(n),[900,3500],'band')*np.exp(-np.arange(n)/SR*28)
# --- parte 1: tensión (La menor, staccato, tic-tac que se acelera) ---
B1=60/126; t=0; k=0
ten=[[110,130.8,164.8],[103.8,130.8,155.6],[98,123.5,146.8],[103.8,123.5,155.6]]
while t<CAMBIO-.05:
    a=ten[(k//8)%4]
    poner(tono(a[0],B1*.5,9)+.5*tono(a[0]*2,B1*.5,12),t,.34)                 # bajo cortado
    if k%2==1: poner(sum(tono(f*2,B1*.4,16) for f in a)/3,t,.16,pan=.4)        # acordes a contratiempo
    poner(tono(2100 if k%2 else 1700,.03,160),t,.10,pan=-.5)                    # tic-tac
    if t>S[1]: poner(tono(2100,.03,160),t+B1/2,.07,pan=.5)
    if t>S[1]-.2: poner(hat(120),t+B1/2,.06)
    t+=B1; k+=1
n=int((CAMBIO)*SR); tt=np.arange(n)/SR                                         # zumbido que crece
poner((np.sin(2*np.pi*55*tt)+.5*np.sin(2*np.pi*82.4*tt))*(tt/tt[-1])**2,0,.10)
poner(kick(),S[3]-.04,.9); poner(filt(rng.standard_normal(int(.5*SR)),[200,2500],'band')*np.exp(-np.arange(int(.5*SR))/SR*7),S[3]-.04,.35)  # golpe en "así no"
# --- parte 2: alivio (Do mayor, abierto, con pulso) ---
B2=60/104; t=CAMBIO; i=0
may=[[130.8,196,261.6,329.6],[174.6,220,261.6,349.2],[110,220,261.6,329.6],[196,246.9,293.7,392]]
n=int(.6*SR); tt=np.arange(n)/SR; poner(np.sin(2*np.pi*np.cumsum(300+900*tt/.6)/SR)*(tt/.6)**2,CAMBIO-.6,.09)   # subida
for f in (1046.5,1318.5,1568): poner(tono(f,1.2,4),CAMBIO+.02,.07)             # campanita al prender la luz
while t<T:
    a=may[i%4]; d=B2*4; n=int(d*SR); tt=np.arange(n)/SR
    poner(sum(np.sin(2*np.pi*f*tt)+.3*np.sin(2*np.pi*f*2.004*tt) for f in a)/7*env(n,.12,.5),t,.30)
    for j in range(4):
        poner(tono(a[0]/2,B2*.9,5),t+j*B2,.30)
        if t+j*B2>S[5]-.1: poner(kick(),t+j*B2,.42); poner(hat(),t+j*B2+B2/2,.09)
        if t+j*B2>S[5]-.1 and j%2==1: poner(clap(),t+j*B2,.13)
    for j in range(8): poner(tono(a[[1,3,2,3][j%4]]*2,.25,14),t+j*B2/2,.06,pan=(-1)**j*.6)
    t+=d; i+=1
for c in CORTES:
    n=int(.4*SR); w=filt(rng.standard_normal(n),[400,5000],'band')*np.linspace(0,1,n)**2.2; poner(w,c-.38,.15)
out=filt(out,38,'high'); f=int(.5*SR); out[-f:]*=np.linspace(1,.2,f)[:,None]; out[:int(.03*SR)]*=np.linspace(0,1,int(.03*SR))[:,None]
out/=np.max(np.abs(out))+1e-9; sf.write('musica.wav',out*.9,SR)
