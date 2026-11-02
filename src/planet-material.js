export const planetVertex=`varying vec3 vPosition;varying vec3 vNormal;varying vec3 vWorldPosition;
void main(){vPosition=position;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vWorldPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`
export const noiseGLSL=`
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.08+vec3(5.2,1.3,2.8);a*=.49;}return v;}`
export const planetFragment=`uniform vec3 tint;uniform vec3 accentColor;uniform float variant;uniform float brightness;uniform float detail;uniform float time;
varying vec3 vPosition;varying vec3 vNormal;varying vec3 vWorldPosition;
${noiseGLSL}
void main(){
 vec3 p=normalize(vPosition);vec3 warp=vec3(noise(p*3.),noise(p*3.+8.),noise(p*3.+17.));float land=fbm(p*(3.1+variant*.23)+warp*.7+vec3(variant*3.7,variant*1.3,variant*.7)),folds=fbm(p*14.+land*2.4),fine=noise(p*180.);
 float shore=smoothstep(.445,.49,land),highland=smoothstep(.53,.71,land);
 vec3 sea=tint*.27,ground=mix(accentColor,tint,.18)*(.72+folds*.32);
 vec3 base=mix(sea,ground,shore);base=mix(base,accentColor*.95,highland*.65);
 float gas=1.-step(.5,abs(variant-2.));float bands=.5+.5*sin(p.y*46.+sin(p.x*5.+p.z*6.)*1.7+folds*2.7);
 vec3 storm=mix(tint*.36,mix(tint,accentColor,.55),smoothstep(.15,.9,bands))*(.8+folds*.35);
 base=mix(base,storm,gas);base*=.98+fine*.025*detail;
 // Six geological families, stable under renamed stages. No bitmap assets.
 if(variant<.5){base=mix(vec3(.014,.063,.12),mix(vec3(.25,.30,.12),accentColor,highland*.7),shore);}
 else if(variant<1.5){float islands=smoothstep(.46,.50,land+noise(p*19.)*.05);base=mix(vec3(.018,.14,.17),mix(vec3(.09,.24,.13),accentColor,highland),islands);}
 else if(variant>2.5&&variant<3.5){float ridges=1.-abs(2.*folds-1.);float basin=smoothstep(.28,.48,noise(p*24.+folds));base=mix(vec3(.12,.052,.028),vec3(.56,.28,.12),land)*(.65+ridges*.6);base*=.7+basin*.3;}
 else if(variant>3.5&&variant<4.5){float coast=smoothstep(.47,.51,land);base=mix(vec3(.015,.035,.16),mix(vec3(.19,.16,.29),vec3(.52,.48,.58),highland),coast);}
 else if(variant>4.5){float cracks=1.-smoothstep(.012,.045,abs(noise(p*22.+folds)-.49));base=mix(vec3(.4,.57,.66),vec3(.8,.87,.9),land)*(.8+folds*.4);base=mix(base,vec3(.045,.13,.23),cracks*.75);}
 float ice=smoothstep(.89,1.05,abs(p.y)+land*.1);base=mix(base,vec3(.8,.86,.95),ice*(1.-gas)*.65);
 vec3 normal=normalize(vNormal),dx=dFdx(vWorldPosition),dy=dFdy(vWorldPosition),tx=cross(dy,normal),ty=cross(normal,dx);float det=dot(dx,tx);
 float height=folds*.0025+fine*.000035*detail;
 normal=normalize(normal-sign(det)*(dFdx(height)*tx+dFdy(height)*ty)/max(abs(det),.00001));
 vec3 view=normalize(cameraPosition-vWorldPosition),light=normalize(vec3(-1.4,.65,.65));float sun=dot(normal,light);
 float diffuse=smoothstep(-.1,.24,sun)*(.15+.85*max(0.,sun));float fill=max(0.,dot(normal,normalize(vec3(.4,-.2,-1.))));
 float cloudShadow=smoothstep(.49,.68,fbm(p*7.+vec3(time*.004+.08,.03,0.)))*.2*(1.-gas);
 vec3 lit=base*(vec3(.025,.037,.065)+vec3(1.,.94,.84)*diffuse*(1.-cloudShadow)+vec3(.025,.035,.065)*fill);
 // Positional warm light from the visible galactic core, with distance falloff.
 vec3 coreDirection=normalize(-vWorldPosition);float coreLight=max(0.,dot(normal,coreDirection))/(1.+dot(vWorldPosition,vWorldPosition)*.015);
 lit+=base*vec3(1.,.65,.32)*coreLight*.22;
 float water=1.-shore;float spec=pow(max(0.,dot(normal,normalize(light+view))),70.);lit+=vec3(.55,.72,.9)*spec*water*.72*diffuse;
 float rim=pow(1.-max(0.,dot(normalize(vNormal),view)),4.5);lit+=mix(tint,vec3(.3,.58,.82),.35)*rim*smoothstep(-.3,.7,sun)*.16;
 gl_FragColor=vec4(lit*brightness,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
export const cloudFragment=`uniform float time;uniform vec3 cloudColor;uniform float opacity;varying vec3 vPosition;varying vec3 vNormal;varying vec3 vWorldPosition;
${noiseGLSL}
void main(){vec3 p=normalize(vPosition);float n=fbm(p*11.+vec3(time*.004,0.,0.)),wisps=noise(p*63.+n);float a=smoothstep(.53,.72,n+wisps*.07)*opacity;float sun=smoothstep(-.12,.75,dot(normalize(vNormal),normalize(vec3(-1.4,.65,.65))));gl_FragColor=vec4(mix(cloudColor,vec3(.8,.85,.93),.65)*(.06+sun*.72),a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
export const atmosphereVertex=`varying vec3 n;varying vec3 eye;varying vec3 sunNormal;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-mv.xyz);sunNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*mv;}`
export const atmosphereFragment=`uniform vec3 glow;uniform float strength;varying vec3 n;varying vec3 eye;varying vec3 sunNormal;
void main(){float mu=abs(dot(normalize(n),normalize(eye)));float edge=exp(-mu*7.)*smoothstep(0.,.12,mu);float sun=smoothstep(-.4,.8,dot(normalize(sunNormal),normalize(vec3(-1.4,.65,.65))));gl_FragColor=vec4(glow,edge*strength*(.18+sun*.82));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`
