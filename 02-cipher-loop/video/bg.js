// WebGL2 nebula / aurora background. window.BG.draw(t, paletteMix[0..1 per palette], intensity)
(function () {
  const cv = document.getElementById('bg');
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  const VS = `#version 300 es
  in vec2 p; out vec2 uv; void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0,1); }`;
  const FS = `#version 300 es
  precision highp float;
  in vec2 uv; out vec4 o;
  uniform float t; uniform vec3 cA; uniform vec3 cB; uniform vec3 cC; uniform float glow; uniform float flash; uniform vec2 focus; uniform float inten;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return v; }
  void main(){
    vec2 p = uv*vec2(1.7778,1.0);
    float tt = t*0.035;
    vec2 q = vec2(fbm(p*1.6+vec2(0.,tt)), fbm(p*1.6+vec2(5.2,-tt)));
    vec2 r = vec2(fbm(p*1.3+3.0*q+vec2(1.7,9.2)+tt*0.8), fbm(p*1.3+3.0*q+vec2(8.3,2.8)-tt*0.6));
    float f = fbm(p*1.1+2.6*r);
    vec3 col = vec3(0.012,0.014,0.04);
    col = mix(col, cA*0.55, smoothstep(0.35,0.95,f)*0.9);
    col = mix(col, cB*0.65, smoothstep(0.45,1.0,length(q))*0.55);
    col += cC*0.35*pow(smoothstep(0.55,1.05,r.x),3.0);
    // aurora ribbons
    float rib = sin(p.x*3.0 + 2.0*fbm(p*2.0+tt) + t*0.05)*0.5+0.5;
    col += cB*0.10*smoothstep(0.85,1.0,rib)*smoothstep(0.2,0.8,uv.y);
    // stars
    vec2 g = floor(gl_FragCoord.xy/2.0);
    float s = h(g); float tw = 0.6+0.4*sin(t*2.0+s*50.0);
    col += vec3(0.8,0.9,1.0)*step(0.9965,s)*tw*0.7;
    // focus glow + vignette
    float d = length((uv-focus)*vec2(1.7778,1.0));
    col += cA*0.10*glow*exp(-d*d*3.0);
    float vig = smoothstep(1.25,0.35,length((uv-0.5)*vec2(1.5,1.0)));
    col *= mix(0.55,1.0,vig) * inten;
    col += vec3(1.0,0.15,0.3)*flash*0.35;
    o = vec4(pow(col, vec3(0.92)),1.0);
  }`;
  function sh(type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const u = { t: U('t'), cA: U('cA'), cB: U('cB'), cC: U('cC'), glow: U('glow'), flash: U("flash"), focus: U("focus"), inten: U("inten") };
  window.BG = { draw(t, pal, glow = 0.6, flash = 0, focus = [0.3, 0.5], inten = 0.6) {
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform1f(u.t, t); gl.uniform3fv(u.cA, pal[0]); gl.uniform3fv(u.cB, pal[1]); gl.uniform3fv(u.cC, pal[2]);
    gl.uniform1f(u.glow, glow); gl.uniform1f(u.flash, flash); gl.uniform2fv(u.focus, focus); gl.uniform1f(u.inten, inten);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } };
})();
