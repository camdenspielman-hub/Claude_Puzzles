/* Ninefold — the 3D world (three.js r128).
   Sky, sea, an island, and four plateaus that rise from the solved grids: digit = column height.
   Act IV builds its plateau live; Act V hands the camera to the island controller. */
(function () {
  const W = { failed: false, ready: false };
  NF.World = W;
  if (!window.THREE) { W.failed = true; return; }
  const T = window.THREE;

  const HS = 0.32;          // height per digit (sun at atan(HS) keeps the shadow rule exact)
  const ISLAND_Y = 0.42;
  const POS = [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]];
  const THEMES = [
    { side: [0xbdb6a8, 0xe9e4d8], cap: [0xd9d2c2, 0xf6f2e8], trees: 0.16, leaf: [0xf2a7c3, 0xf7d2dc, 0xe8789a] },
    { side: [0x56744c, 0x86a46c], cap: [0x5d9a46, 0xa8d46a], trees: 0.32, leaf: [0x4fa646, 0x8ccc3c, 0xf2d45c, 0x2f8a40] },
    { side: [0x46506f, 0x7c87b8], cap: [0x5b6aa0, 0xaab4e6], trees: 0.16, leaf: [0x8a74c9, 0x5e8fd6, 0xc9a3e8] },
    { side: [0x7d6a58, 0xb7a58f], cap: null, trees: 0.22, leaf: [0xf5a142, 0xe0584a, 0xf2d45c, 0xf2a7c3, 0xd9692f] },
  ];

  let renderer, scene, camera, composer, bloom, clock;
  let skyMat, oceanMat, hemi, sun, amb, island, fill;
  let fireflies, pollen, lanternGroup;
  let act = -1;
  const plateaus = [];
  const cam = {
    target: new T.Vector3(0, 1, 0), dist: 46, yaw: 0.7, pitch: 0.32, offX: 0, offY: 0,
    want: { target: new T.Vector3(0, 1, 0), dist: 46, yaw: 0.7, pitch: 0.32, offX: 0, offY: 0 },
    orbit: 0.012, user: null,
  };
  W.cam = cam;
  const tmpObj = new T.Object3D();
  const tmpCol = new T.Color();

  /* ------------------------------------------------------------------ helpers */
  function lerpColor(a, b, t) { return tmpCol.setHex(a).lerp(new T.Color(b), t).clone(); }
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function heightOf(d) { return d > 0 ? 0.12 + d * HS : 0.04; }

  function capColour(k, d) {
    if (k === 3) {
      if (!d) return new T.Color(0x6fa8c9);
      if (d <= 2) return new T.Color(0xe3cf9a);
      if (d <= 5) return lerpColor(0x86b867, 0x5c9a4f, (d - 3) / 2);
      if (d <= 7) return lerpColor(0x7c8a5a, 0x8c7b6b, (d - 6));
      if (d === 8) return new T.Color(0xb3a596);
      return new T.Color(0xf6f6f2);
    }
    const th = THEMES[k];
    return lerpColor(th.cap[0], th.cap[1], (d - 1) / 8);
  }
  function sideColour(k, d) {
    const th = THEMES[k];
    if (k === 3 && !d) return new T.Color(0x5d93b5);
    return lerpColor(th.side[0], th.side[1], Math.max(0, d - 1) / 8);
  }

  /* ------------------------------------------------------------------ sky */
  function makeSky() {
    skyMat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false,
      uniforms: {
        top: { value: new T.Color(0x8fc3e0) }, horizon: { value: new T.Color(0xf3ead2) }, bottom: { value: new T.Color(0xcfe3e8) },
        sunDir: { value: new T.Vector3(0.3, 0.5, -0.8).normalize() }, sunCol: { value: new T.Color(0xfff2d0) },
        stars: { value: 0 }, time: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top, horizon, bottom, sunCol, sunDir; uniform float stars, time; varying vec3 vDir;
        float h(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          float y = vDir.y;
          vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(horizon, bottom, clamp(-y*4.0,0.0,1.0));
          float s = max(dot(vDir, normalize(sunDir)), 0.0);
          c += sunCol * (pow(s, 900.0) * 1.6 + pow(s, 12.0) * 0.28 + pow(s, 3.0) * 0.08);
          if (stars > 0.0 && y > 0.0) {
            vec3 q = floor(vDir * 380.0);
            float r = h(q);
            float tw = 0.6 + 0.4 * sin(time * 2.0 + r * 50.0);
            c += vec3(step(0.9965, r) * tw * stars * smoothstep(0.0, 0.25, y));
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const m = new T.Mesh(new T.SphereGeometry(600, 48, 24), skyMat);
    m.renderOrder = -10;
    scene.add(m);
  }

  /* ------------------------------------------------------------------ ocean */
  function makeOcean() {
    const geo = new T.PlaneGeometry(1200, 1200, 220, 220);
    geo.rotateX(-Math.PI / 2);
    oceanMat = new T.ShaderMaterial({
      transparent: false,
      uniforms: {
        time: { value: 0 }, deep: { value: new T.Color(0x2b6f8f) }, shallow: { value: new T.Color(0x7cc6c9) },
        sunDir: { value: new T.Vector3(0.3, 0.5, -0.8).normalize() }, sunCol: { value: new T.Color(0xfff2d0) },
        fogCol: { value: new T.Color(0xf3ead2) }, fogNear: { value: 60 }, fogFar: { value: 360 }, camPos: { value: new T.Vector3() },
        sky: { value: new T.Color(0x9fd0e6) },
      },
      vertexShader: `
        uniform float time; varying vec3 vW; varying vec3 vN;
        float wv(vec2 p, vec2 d, float f, float a, float s){ return a*sin(dot(p,d)*f + time*s); }
        float H(vec2 p){ return wv(p,normalize(vec2(1.,.3)),.32,.09,1.0)+wv(p,normalize(vec2(-.4,1.)),.55,.05,1.6)+wv(p,normalize(vec2(.7,-.8)),1.2,.025,2.2)+wv(p,normalize(vec2(-.9,-.2)),2.1,.012,3.1); }
        void main(){
          vec3 p = (modelMatrix * vec4(position,1.0)).xyz;
          float h = H(p.xz);
          float e = 0.15;
          vec3 n = normalize(vec3(H(p.xz-vec2(e,0.))-H(p.xz+vec2(e,0.)), 2.0*e, H(p.xz-vec2(0.,e))-H(p.xz+vec2(0.,e))));
          p.y += h;
          vW = p; vN = n;
          gl_Position = projectionMatrix * viewMatrix * vec4(p,1.0);
        }`,
      fragmentShader: `
        uniform vec3 deep, shallow, sunDir, sunCol, fogCol, camPos, sky; uniform float fogNear, fogFar, time; varying vec3 vW; varying vec3 vN;
        void main(){
          vec3 v = normalize(camPos - vW);
          vec3 n = normalize(vN);
          float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          float dIsland = length(max(abs(vW.xz) - vec2(11.5), 0.0));
          vec3 base = mix(shallow, deep, smoothstep(0.5, 9.0, dIsland));
          vec3 c = mix(base, sky, fr * 0.55);
          vec3 r = reflect(-normalize(sunDir), n);
          c += sunCol * pow(max(dot(r, v), 0.0), 180.0) * 1.4;
          float foam = smoothstep(1.2, 0.2, dIsland) * (0.55 + 0.45 * sin(time * 1.3 + vW.x * 2.0 + vW.z * 1.7));
          c = mix(c, vec3(0.97), foam * 0.6);
          float d = length(camPos - vW);
          float f = smoothstep(fogNear, fogFar, d);
          gl_FragColor = vec4(mix(c, fogCol, f), 1.0);
        }`,
    });
    const m = new T.Mesh(geo, oceanMat);
    m.position.y = 0;
    scene.add(m);
  }

  /* ------------------------------------------------------------------ island base */
  function roundedRect(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function makeIsland() {
    island = new T.Group();
    const shape = roundedRect(23.5, 23.5, 3.2);
    const geo = new T.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 1.2, bevelSegments: 4, curveSegments: 16 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, ISLAND_Y - 1.2 - 0.6, 0);
    const mat = new T.MeshStandardMaterial({ color: 0xcfb682, roughness: 0.95, flatShading: true });
    const base = new T.Mesh(geo, mat);
    base.receiveShadow = true;
    island.add(base);
    // paths between plateaus
    const pathMat = new T.MeshStandardMaterial({ color: 0xd9c592, roughness: 1 });
    [[0, 0, 22, 1.4], [0, 0, 1.4, 22]].forEach(([x, z, w, d]) => {
      const p = new T.Mesh(new T.BoxGeometry(w, 0.04, d), pathMat);
      p.position.set(x, ISLAND_Y + 0.02, z);
      p.receiveShadow = true;
      island.add(p);
    });
    // scattered rocks on the beach
    const rockGeo = new T.DodecahedronGeometry(0.35, 0);
    const rockMat = new T.MeshStandardMaterial({ color: 0xa79f92, roughness: 1, flatShading: true });
    const rocks = new T.InstancedMesh(rockGeo, rockMat, 40);
    for (let i = 0; i < 40; i++) {
      const a = hash(i) * Math.PI * 2;
      const rr = 12.4 + hash(i + 50) * 1.4;
      tmpObj.position.set(Math.cos(a) * rr, ISLAND_Y - 0.15, Math.sin(a) * rr);
      tmpObj.rotation.set(hash(i + 9) * 3, hash(i + 7) * 3, 0);
      const s = 0.6 + hash(i + 3) * 1.4;
      tmpObj.scale.set(s, s * 0.7, s);
      tmpObj.updateMatrix();
      rocks.setMatrixAt(i, tmpObj.matrix);
    }
    rocks.castShadow = true;
    island.add(rocks);
    scene.add(island);
  }

  /* ------------------------------------------------------------------ plateaus */
  function makePlateau(k) {
    const [px, pz] = POS[k];
    const g = new T.Group();
    g.position.set(px, ISLAND_Y, pz);
    const bodyGeo = new T.BoxGeometry(0.98, 1, 0.98); bodyGeo.translate(0, 0.5, 0);
    const capGeo = new T.BoxGeometry(1.0, 0.07, 1.0); capGeo.translate(0, 0.035, 0);
    const bodyMat = new T.MeshStandardMaterial({ roughness: 0.92, flatShading: true });
    const capMat = new T.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
    const body = new T.InstancedMesh(bodyGeo, bodyMat, 81);
    const cap = new T.InstancedMesh(capGeo, capMat, 81);
    body.castShadow = body.receiveShadow = true;
    cap.castShadow = cap.receiveShadow = true;
    g.add(body, cap);
    const P = { k, g, body, cap, h: new Float32Array(81), target: new Float32Array(81), delay: new Float32Array(81), digits: new Array(81).fill(0), trees: null, treeH: new Float32Array(81), visible: false, extras: new Set() };
    for (let i = 0; i < 81; i++) { P.h[i] = 0; P.target[i] = 0; }
    g.visible = false;
    scene.add(g);
    plateaus[k] = P;
    applyPlateau(P, true);
    return P;
  }

  function applyPlateau(P, colours) {
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const h = Math.max(0.001, P.h[i]);
      tmpObj.position.set(c - 4, 0, r - 4);
      tmpObj.rotation.set(0, 0, 0);
      tmpObj.scale.set(1, h, 1);
      tmpObj.updateMatrix();
      P.body.setMatrixAt(i, tmpObj.matrix);
      tmpObj.position.set(c - 4, h, r - 4);
      tmpObj.scale.set(1, 1, 1);
      tmpObj.updateMatrix();
      P.cap.setMatrixAt(i, tmpObj.matrix);
      if (colours) {
        const d = P.digits[i];
        P.body.setColorAt(i, sideColour(P.k, d));
        let cc = capColour(P.k, d);
        if (P.waterCells && P.waterCells.has(i)) cc = new T.Color(0x4a9bd6);
        P.cap.setColorAt(i, cc);
      }
    }
    P.body.instanceMatrix.needsUpdate = true;
    P.cap.instanceMatrix.needsUpdate = true;
    if (colours) {
      if (P.body.instanceColor) P.body.instanceColor.needsUpdate = true;
      if (P.cap.instanceColor) P.cap.instanceColor.needsUpdate = true;
    }
    if (P.trees) placeTrees(P);
  }

  function makeTrees(P) {
    const th = THEMES[P.k];
    const spots = [];
    for (let i = 0; i < 81; i++) if (hash(P.k * 97 + i) < th.trees && (P.k !== 3 || !(P.waterCells && P.waterCells.has(i)))) spots.push(i);
    const trunkGeo = new T.CylinderGeometry(0.035, 0.05, 0.34, 5); trunkGeo.translate(0, 0.17, 0);
    const leafGeo = new T.IcosahedronGeometry(0.26, 0);
    const trunk = new T.InstancedMesh(trunkGeo, new T.MeshStandardMaterial({ color: 0x6b4f3a, flatShading: true }), spots.length);
    const leaf = new T.InstancedMesh(leafGeo, new T.MeshStandardMaterial({ roughness: 0.75, flatShading: true }), spots.length);
    trunk.castShadow = leaf.castShadow = true;
    spots.forEach((i, j) => leaf.setColorAt(j, new T.Color(th.leaf[Math.floor(hash(i * 3 + P.k) * th.leaf.length)])));
    P.g.add(trunk, leaf);
    P.trees = { spots, trunk, leaf, grow: 0 };
    placeTrees(P);
  }
  function placeTrees(P) {
    const t = P.trees;
    t.spots.forEach((i, j) => {
      const r = Math.floor(i / 9), c = i % 9;
      const s = Math.max(0.001, t.grow * (0.8 + hash(i) * 0.5));
      const y = Math.max(0.001, P.h[i]) + 0.07;
      const ox = (hash(i + 1) - 0.5) * 0.4, oz = (hash(i + 2) - 0.5) * 0.4;
      tmpObj.position.set(c - 4 + ox, y, r - 4 + oz);
      tmpObj.rotation.set(0, hash(i) * 6, 0);
      tmpObj.scale.set(s, s, s);
      tmpObj.updateMatrix();
      t.trunk.setMatrixAt(j, tmpObj.matrix);
      tmpObj.position.set(c - 4 + ox, y + 0.42 * s, r - 4 + oz);
      tmpObj.scale.set(s * 1.1, s * 1.25, s * 1.1);
      tmpObj.updateMatrix();
      t.leaf.setMatrixAt(j, tmpObj.matrix);
    });
    t.trunk.instanceMatrix.needsUpdate = true;
    t.leaf.instanceMatrix.needsUpdate = true;
    if (t.leaf.instanceColor) t.leaf.instanceColor.needsUpdate = true;
  }

  W.raisePlateau = function (k, solution, instant) {
    if (W.failed) return;
    const P = plateaus[k] || makePlateau(k);
    P.g.visible = true;
    const now = clock ? clock.getElapsedTime() : 0;
    for (let i = 0; i < 81; i++) {
      const d = +solution[i];
      P.digits[i] = d;
      P.target[i] = heightOf(d);
      const r = Math.floor(i / 9), c = i % 9;
      P.delay[i] = instant ? 0 : now + 0.6 + (Math.hypot(r - 4, c - 4) * 0.22) + hash(i + k) * 0.5;
      if (instant) P.h[i] = P.target[i];
    }
    applyPlateau(P, true);
    if (!P.trees && THEMES[k].trees) makeTrees(P);
    if (instant && P.trees) { P.trees.grow = 1; placeTrees(P); }
    else if (P.trees) P.trees.growAt = now + 4.5;
    if (k === 2) addLanterns(P, solution);
  };

  /* Act IV live terrain */
  W.setTerrainFeatures = function (features) {
    const P = plateaus[3] || makePlateau(3);
    P.waterCells = new Set();
    (features || []).forEach(f => {
      if (f.type === 'river' || f.type === 'lake') f.cells.forEach(([r, c]) => P.waterCells.add(r * 9 + c));
    });
    P.peaks = (features || []).filter(f => f.type === 'peak').map(f => f.cells[0][0] * 9 + f.cells[0][1]);
  };
  W.updateTerrain = function (values) {
    if (W.failed || !scene) return;
    const P = plateaus[3] || makePlateau(3);
    P.g.visible = true;
    let changed = false;
    for (let i = 0; i < 81; i++) {
      const d = values[i] || 0;
      if (P.digits[i] !== d) { P.digits[i] = d; changed = true; }
      P.target[i] = heightOf(d);
      P.delay[i] = 0;
    }
    if (changed) applyPlateau(P, true);
    if (!P.trees) { makeTrees(P); P.trees.grow = 0; }
    P.treeTarget = values.filter(Boolean).length / 81;
  };

  function addLanterns(P, solution) {
    if (lanternGroup) return;
    lanternGroup = new T.Group();
    const geo = new T.SphereGeometry(0.09, 10, 8);
    const mat = new T.MeshBasicMaterial({ color: 0xffd27a });
    for (let i = 0; i < 81; i++) {
      if (hash(i * 5 + 11) > 0.16) continue;
      const m = new T.Mesh(geo, mat);
      m.userData.i = i;
      lanternGroup.add(m);
    }
    P.g.add(lanternGroup);
    P.lanterns = lanternGroup;
  }

  /* ------------------------------------------------------------------ particles */
  function makeParticles() {
    const n = 260;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (hash(i) - 0.5) * 34; pos[i * 3 + 1] = 0.6 + hash(i + 1) * 5; pos[i * 3 + 2] = (hash(i + 2) - 0.5) * 34; seed[i] = hash(i + 3);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new T.BufferAttribute(seed, 1));
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { time: { value: 0 }, col: { value: new T.Color(0xd6ff7a) }, size: { value: 90 }, amount: { value: 0 }, drift: { value: 1 } },
      vertexShader: `uniform float time, size, drift; attribute float seed; varying float vA;
        void main(){ vec3 p = position; float t = time*0.25 + seed*20.0;
          p.x += sin(t*1.3 + seed*7.0)*0.9*drift; p.y += sin(t*0.9 + seed*3.0)*0.5 + (drift < 0.5 ? mod(time*0.15+seed*6.0, 6.0) : 0.0); p.z += cos(t*1.1 + seed*5.0)*0.9*drift;
          vA = 0.5 + 0.5*sin(time*(1.5+seed*2.5) + seed*30.0);
          vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = size*(0.4+seed*0.6)/(-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 col; uniform float amount; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(col, a*vA*amount); }`,
    });
    fireflies = new T.Points(geo, mat);
    fireflies.position.y = ISLAND_Y;
    scene.add(fireflies);
  }

  /* ------------------------------------------------------------------ environment presets */
  const ENV = {
    1: { top: 0x8fc3e0, horizon: 0xf1ead6, bottom: 0xcfe3e8, fog: 0xe9eadf, fogNear: 50, fogFar: 300, sun: [0.55, 0.62, -0.55], sunCol: 0xfff0cc, sunI: 1.05, hemiSky: 0xdfefff, hemiGround: 0xb9a77c, hemiI: 0.65, stars: 0, deep: 0x2f7a93, shallow: 0x86cfc8, sea: 0x9fd0e6, flies: 0.0, fliesCol: 0xfff3b0, bloom: 0.25 },
    2: { top: 0x070b1d, horizon: 0x2c3364, bottom: 0x0b0f22, fog: 0x1a2046, fogNear: 30, fogFar: 170, sun: [-0.35, 0.55, -0.6], sunCol: 0xa9b8ff, sunI: 0.45, hemiSky: 0x5361a8, hemiGround: 0x15172b, hemiI: 0.45, stars: 1, deep: 0x0c1838, shallow: 0x22356b, sea: 0x1b2450, flies: 1, fliesCol: 0xd6ff7a, bloom: 0.9 },
    3: { top: 0x9cc7dd, horizon: 0xf3d8a8, bottom: 0xd8e6e8, fog: 0xeadfc8, fogNear: 50, fogFar: 280, sun: [0.75, 0.42, 0.35], sunCol: 0xffe2b0, sunI: 1.45, hemiSky: 0xe6f0ff, hemiGround: 0xa48f68, hemiI: 0.55, stars: 0, deep: 0x2d6f8c, shallow: 0x7cc3c2, sea: 0xa7d1de, flies: 0, fliesCol: 0xfff3b0, bloom: 0.2 },
    4: { top: 0x4ea6e0, horizon: 0xd9f0ee, bottom: 0xbfe2ea, fog: 0xd0e9ec, fogNear: 60, fogFar: 340, sun: [0.5, 0.62, 0.42], sunCol: 0xfff1d6, sunI: 1.25, hemiSky: 0xd6ecff, hemiGround: 0x9c8a62, hemiI: 0.5, stars: 0, deep: 0x1f7fa6, shallow: 0x5fd0d0, sea: 0x8fd3e8, flies: 0, fliesCol: 0xfff3b0, bloom: 0.3 },
  };
  let env = null, envFrom = null, envT = 1;
  function snapshotEnv() {
    return {
      top: skyMat.uniforms.top.value.clone(), horizon: skyMat.uniforms.horizon.value.clone(), bottom: skyMat.uniforms.bottom.value.clone(),
      fog: scene.fog.color.clone(), fogNear: scene.fog.near, fogFar: scene.fog.far,
      sun: skyMat.uniforms.sunDir.value.clone(), sunCol: sun.color.clone(), sunI: sun.intensity,
      hemiSky: hemi.color.clone(), hemiGround: hemi.groundColor.clone(), hemiI: hemi.intensity, stars: skyMat.uniforms.stars.value,
      deep: oceanMat.uniforms.deep.value.clone(), shallow: oceanMat.uniforms.shallow.value.clone(), sea: oceanMat.uniforms.sky.value.clone(),
      flies: fireflies.material.uniforms.amount.value, fliesCol: fireflies.material.uniforms.col.value.clone(), bloom: bloom ? bloom.strength : 0,
    };
  }
  function normEnv(e) {
    const c = (x) => (x instanceof T.Color ? x : new T.Color(x));
    return {
      top: c(e.top), horizon: c(e.horizon), bottom: c(e.bottom), fog: c(e.fog), fogNear: e.fogNear, fogFar: e.fogFar,
      sun: e.sun instanceof T.Vector3 ? e.sun : new T.Vector3(...e.sun).normalize(), sunCol: c(e.sunCol), sunI: e.sunI,
      hemiSky: c(e.hemiSky), hemiGround: c(e.hemiGround), hemiI: e.hemiI, stars: e.stars, deep: c(e.deep), shallow: c(e.shallow), sea: c(e.sea),
      flies: e.flies, fliesCol: c(e.fliesCol), bloom: e.bloom,
    };
  }
  function setEnv(preset, seconds) {
    envFrom = snapshotEnv();
    env = normEnv(preset);
    envT = seconds ? 0 : 1;
    W.envDur = seconds || 0.001;
    if (!seconds) applyEnv(1);
  }
  W.setEnv = (p, s) => { if (!W.failed && scene) setEnv(p, s); };
  W.ENV = ENV;
  function applyEnv(t) {
    const a = envFrom, b = env;
    if (!a || !b) return;
    const L = (x, y) => x + (y - x) * t;
    skyMat.uniforms.top.value.copy(a.top).lerp(b.top, t);
    skyMat.uniforms.horizon.value.copy(a.horizon).lerp(b.horizon, t);
    skyMat.uniforms.bottom.value.copy(a.bottom).lerp(b.bottom, t);
    scene.fog.color.copy(a.fog).lerp(b.fog, t);
    scene.fog.near = L(a.fogNear, b.fogNear); scene.fog.far = L(a.fogFar, b.fogFar);
    const sd = a.sun.clone().lerp(b.sun, t).normalize();
    skyMat.uniforms.sunDir.value.copy(sd);
    oceanMat.uniforms.sunDir.value.copy(sd);
    sun.position.copy(sd).multiplyScalar(60);
    sun.color.copy(a.sunCol).lerp(b.sunCol, t);
    skyMat.uniforms.sunCol.value.copy(sun.color);
    oceanMat.uniforms.sunCol.value.copy(sun.color);
    sun.intensity = L(a.sunI, b.sunI);
    hemi.color.copy(a.hemiSky).lerp(b.hemiSky, t);
    hemi.groundColor.copy(a.hemiGround).lerp(b.hemiGround, t);
    hemi.intensity = L(a.hemiI, b.hemiI);
    skyMat.uniforms.stars.value = L(a.stars, b.stars);
    oceanMat.uniforms.deep.value.copy(a.deep).lerp(b.deep, t);
    oceanMat.uniforms.shallow.value.copy(a.shallow).lerp(b.shallow, t);
    oceanMat.uniforms.sky.value.copy(a.sea).lerp(b.sea, t);
    oceanMat.uniforms.fogCol.value.copy(scene.fog.color);
    oceanMat.uniforms.fogNear.value = scene.fog.near; oceanMat.uniforms.fogFar.value = scene.fog.far;
    fireflies.material.uniforms.amount.value = L(a.flies, b.flies);
    fireflies.material.uniforms.col.value.copy(a.fliesCol).lerp(b.fliesCol, t);
    if (bloom) bloom.strength = L(a.bloom, b.bloom);
  }

  /* Act IV evening: the sun drops into the west at exactly atan(HS) so shadows match the rule */
  W.eveningSun = function (on, seconds) {
    if (W.failed || !scene) return;
    const base = ENV[3];
    const elev = Math.atan(HS);
    const preset = Object.assign({}, base, on ? {
      sun: [-Math.cos(elev), Math.sin(elev), 0.0001], sunCol: 0xffb36b, sunI: 1.9, top: 0x7da6c8, horizon: 0xf6b57d, fog: 0xf0c9a0, hemiI: 0.35, hemiSky: 0xffd6b0,
    } : {});
    setEnv(preset, seconds == null ? 4 : seconds);
  };

  /* ------------------------------------------------------------------ framing */
  const FRAMES = {
    1: () => ({ target: [0, 1.5, 0], dist: 62, yaw: 0.78, pitch: 0.2, offX: 0, offY: -0.12, orbit: 0.01 }),
    2: () => ({ target: [0, 1.2, 0], dist: 56, yaw: 2.3, pitch: 0.18, offX: 0, offY: -0.1, orbit: 0.008 }),
    3: () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const base = { target: [5.5, 1.4, 5.5], dist: 20, yaw: 0.25, pitch: 0.6, offX: 0, offY: 0.22, orbit: 0.0 };
      if (vw <= 860) return base;
      // fit the whole plateau into the free area right of the rules panel instead of half behind
      // it; at this angle the plateau is about 17.3 * vh / dist px wide on screen
      const side = document.getElementById('side');
      const sr = side ? side.getBoundingClientRect() : null;
      const left = sr && sr.width ? sr.right + 12 : vw * 0.62;
      const free = vw - left - 12;
      if (free < 190) return Object.assign(base, { offX: -0.3, offY: 0 });
      const dist = Math.max(20, Math.min(46, 17.3 * vh / (0.92 * free)));
      const cx = left + free / 2 + 50 * (20 / dist) * (vh / 800); // the box sits a little left of the target
      return Object.assign(base, { dist, offX: -(cx / vw - 0.5), offY: 0 });
    },
    4: () => ({ target: [0, 1.2, 0], dist: 40, yaw: 0.6, pitch: 0.42, offX: 0, offY: 0, orbit: 0.02 }),
  };
  function frame(f, instant) {
    const w = cam.want;
    w.target.set(...f.target); w.dist = f.dist; w.yaw = f.yaw; w.pitch = f.pitch; w.offX = f.offX; w.offY = f.offY;
    cam.orbit = f.orbit;
    if (instant) { cam.target.copy(w.target); cam.dist = w.dist; cam.yaw = w.yaw; cam.pitch = w.pitch; cam.offX = w.offX; cam.offY = w.offY; }
  }
  W.frame = frame;
  W.FRAMES = FRAMES;

  W.setAct = function (i, instant) {
    if (W.failed || !scene) return;
    act = i;
    const preset = ENV[Math.max(1, i)];
    if (i >= 1) setEnv(preset, instant ? 0 : 5);
    if (FRAMES[i]) frame(FRAMES[i](), instant);
    if (i === 3) {
      const a = NF.DATA.acts[3];
      W.setTerrainFeatures([].concat(a.constraints || [], ...(a.stages || []).map(s => s.add || [])));
    }
    W.terrainHero = false;
  };

  W.buildUpTo = function (i) {
    if (W.failed || !scene) return;
    for (let k = 0; k < Math.min(i, 4); k++) W.raisePlateau(k, NF.DATA.acts[k].solution, true);
    if (i >= 1) document.getElementById('app').classList.add('world-on');
  };

  W.toggleTerrainHero = function (on) {
    W.terrainHero = on;
    if (W.failed || !scene) return;
    if (on) frame({ target: [5.5, 1.6, 5.5], dist: 17, yaw: cam.yaw, pitch: 0.55, offX: 0, offY: 0, orbit: 0.03 });
    else frame(FRAMES[3]());
  };

  /* a short cinematic look at plateau k while the puzzle UI steps aside */
  W.showcase = function (k, ms) {
    if (W.failed || !scene) return Promise.resolve();
    const [px, pz] = POS[k];
    const keep = { target: cam.want.target.clone(), dist: cam.want.dist, yaw: cam.want.yaw, pitch: cam.want.pitch, offX: cam.want.offX, offY: cam.want.offY, orbit: cam.orbit };
    frame({ target: [px, 1.6, pz], dist: 19, yaw: Math.atan2(px, pz) + 0.35, pitch: 0.42, offX: 0, offY: 0, orbit: 0.06 });
    return new Promise(res => setTimeout(() => {
      frame({ target: [keep.target.x, keep.target.y, keep.target.z], dist: keep.dist, yaw: keep.yaw, pitch: keep.pitch, offX: keep.offX, offY: keep.offY, orbit: keep.orbit });
      res();
    }, ms || 5200));
  };

  W.pullBack = function () {
    if (W.failed || !scene) return Promise.resolve();
    return new Promise(res => {
      setEnv(ENV[4], 6);
      frame({ target: [0, 1.0, 0], dist: 48, yaw: 0.9, pitch: 0.55, offX: 0, offY: 0, orbit: 0.03 });
      for (let k = 0; k < 4; k++) if (plateaus[k]) plateaus[k].g.visible = true;
      setTimeout(res, 5200);
    });
  };

  /* ------------------------------------------------------------------ init + loop */
  W.init = async function (canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    // colours are authored as display values, so render without an output gamma curve
    renderer.outputEncoding = T.LinearEncoding;
    renderer.toneMapping = T.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.fog = new T.Fog(0xe9eadf, 50, 300);
    camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 2000);
    W.scene = scene; W.camera = camera; W.renderer = renderer; W.T = T;
    hemi = new T.HemisphereLight(0xdfefff, 0xb9a77c, 0.65);
    scene.add(hemi);
    sun = new T.DirectionalLight(0xfff0cc, 1.35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);
    makeSky();
    makeOcean();
    makeIsland();
    makeParticles();
    for (let k = 0; k < 4; k++) makePlateau(k);
    envFrom = null;
    env = normEnv(ENV[1]); envFrom = env; applyEnv(1);
    frame(FRAMES[1](), true);
    clock = new T.Clock();
    W.ready = true;
    W.resize();
    loop();
  };

  W.resize = function () {
    if (!renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
    if (act === 3 && !W.terrainHero) frame(FRAMES[3]());
  };

  let last = 0;
  function loop() {
    requestAnimationFrame(loop);
    const app = document.getElementById('app');
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, t - last); last = t;
    if (!app.classList.contains('world-on') && act < 1) return; // idle while hidden on paper
    // env blend
    if (envT < 1) { envT = Math.min(1, envT + dt / W.envDur); applyEnv(envT * envT * (3 - 2 * envT)); }
    skyMat.uniforms.time.value = t;
    oceanMat.uniforms.time.value = t;
    fireflies.material.uniforms.time.value = t;
    // plateaus
    plateaus.forEach(P => {
      if (!P || !P.g.visible) return;
      let moving = false;
      for (let i = 0; i < 81; i++) {
        if (P.delay[i] > t) continue;
        const d = P.target[i] - P.h[i];
        if (Math.abs(d) > 0.0015) { P.h[i] += d * Math.min(1, dt * 3.2); moving = true; }
        else P.h[i] = P.target[i];
      }
      if (P.trees) {
        const goal = P.k === 3 ? (P.treeTarget || 0) : (P.trees.growAt && t > P.trees.growAt ? 1 : P.trees.grow);
        if (Math.abs(goal - P.trees.grow) > 0.002) { P.trees.grow += (goal - P.trees.grow) * Math.min(1, dt * 1.5); moving = true; }
      }
      if (moving) applyPlateau(P, false);
      if (P.lanterns) P.lanterns.children.forEach(m => {
        const i = m.userData.i, r = Math.floor(i / 9), c = i % 9;
        m.position.set(c - 4 + 0.3, Math.max(0.001, P.h[i]) + 0.25 + Math.sin(t * 2 + i) * 0.05, r - 4 + 0.3);
        m.visible = act >= 2;
      });
    });
    // camera
    const w = cam.want, k = Math.min(1, dt * 1.4);
    if (cam.user) { /* island controller drives the camera directly */ }
    else {
      w.yaw += cam.orbit * dt;
      cam.target.lerp(w.target, k);
      cam.dist += (w.dist - cam.dist) * k;
      cam.yaw += (w.yaw - cam.yaw) * k;
      cam.pitch += (w.pitch - cam.pitch) * k;
      cam.offX += (w.offX - cam.offX) * k;
      cam.offY += (w.offY - cam.offY) * k;
      const cp = Math.cos(cam.pitch);
      camera.position.set(cam.target.x + Math.sin(cam.yaw) * cp * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * cp * cam.dist);
      camera.lookAt(cam.target);
      const vw = window.innerWidth, vh = window.innerHeight;
      if (Math.abs(cam.offX) > 0.001 || Math.abs(cam.offY) > 0.001) camera.setViewOffset(vw, vh, cam.offX * vw, cam.offY * vh, vw, vh);
      else camera.clearViewOffset();
    }
    sun.target.position.set(0, 0, 0);
    oceanMat.uniforms.camPos.value.copy(camera.position);
    W.onFrame && W.onFrame(t, dt);
    renderer.render(scene, camera);
  }

  W.plateaus = plateaus;
  W.POS = POS;
  W.HS = HS;
  W.ISLAND_Y = ISLAND_Y;
  W.heightOf = heightOf;
})();
