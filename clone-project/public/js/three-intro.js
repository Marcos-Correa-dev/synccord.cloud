/**
 * SyncCord Three.js + GSAP 3D Purple & Lilac Experience
 * Features:
 * - Spheres ("Bolas") with translucent crystal purple outer shell and radiant glowing Lilac inner core
 * - Mirrors ("Espelhos"): floating high-reflectivity mirror facets (hexagons, diamond octahedrons, rectangular mirror slabs)
 * - Procedural Purple/Lilac environment reflection map per theme for realistic specular mirror reflections
 * - Undulating 3D wave grid / neon purple terrain
 * - Floating particle nebula / starfield
 * - Reliable Interactive 3D Gradient Theme Switcher (Lilás & Púrpura, Ciber Violeta, Ametista Neon)
 * - Interactive vertical drag gesture on Auth Modal (left-click + drag up fades out, left-click + drag down restores to center)
 * - Interactive mouse parallax camera tracking + 3D reaction to vertical modal drag
 */

(function () {
  'use strict';

  let scene, camera, renderer;
  let ambientLight, pointLight1, pointLight2, pointLight3, dirLight;
  let mainSphereGroup, mainSphereShell, mainSphereCore, mainSphereLight, mainRing1, mainRing2;
  let satelliteOrbs = [];
  let mirrorObjects = [];
  let waveGrid, particles;
  let animationFrameId = null;
  let isRunning = false;
  let mouseX = 0, mouseY = 0;
  let targetCameraX = 0, targetCameraY = 0;
  let dragProgress = 0; // 0 = modal centered, 1 = modal faded upward
  let clock;
  let gridOriginalPositions = null;
  let sphereOriginalPositions = null;
  let currentThemeName = localStorage.getItem('synccord_intro_3d_theme') || 'lilac-purple';
  const envTextureCache = {};
  let introTimeline = null;
  let isModalDismissedUp = false;
  let domEventsBound = false;

  // Theme color configurations (distinct, rich palettes for 3D WebGL + CSS UI)
  const INTRO_THEMES = {
    'lilac-purple': {
      name: 'Lilás & Púrpura',
      background: 0x090314,
      fog: 0x090314,
      ambient: 0x2e1065,
      shellColor: 0x7c3aed,
      shellEmissive: 0x4c1d95,
      coreColor: 0xf5f3ff,
      coreEmissive: 0xd8b4fe,
      ringSecondary: 0x9333ea,
      mirrorEdge: 0xd8b4fe,
      gridColor: 0x2e1065,
      gridEmissive: 0x581c87,
      keyLight: 0xc084fc,
      fillLight: 0x9333ea,
      rimLight: 0xa855f7,
      dirLight: 0xc4b5fd,
      particles: 0xd8b4fe,
      envStops: ['#090314', '#3b0764', '#7c3aed', '#c084fc', '#e9d5ff', '#a855f7', '#1e0836'],
      cssBg: 'radial-gradient(circle at 50% 35%, #2e1065 0%, #090314 70%)',
      cssPrimary: '#9333ea',
      cssAccent: '#c084fc',
      cssGlow: 'rgba(192, 132, 252, 0.48)',
      cssBorder: 'rgba(168, 85, 247, 0.36)',
      cssSurface: 'rgba(18, 7, 36, 0.86)',
    },
    'cyber-violet': {
      name: 'Ciber Violeta',
      background: 0x120322,
      fog: 0x120322,
      ambient: 0x4a044e,
      shellColor: 0x9d174d,
      shellEmissive: 0x701a75,
      coreColor: 0xfff1f2,
      coreEmissive: 0xf472b6,
      ringSecondary: 0xec4899,
      mirrorEdge: 0xf472b6,
      gridColor: 0x4a044e,
      gridEmissive: 0x86198f,
      keyLight: 0xf472b6,
      fillLight: 0xd946ef,
      rimLight: 0x38bdf8,
      dirLight: 0xf0abfc,
      particles: 0xf9a8d4,
      envStops: ['#120322', '#4a044e', '#a21caf', '#ec4899', '#f9a8d4', '#38bdf8', '#240536'],
      cssBg: 'radial-gradient(circle at 50% 35%, #4a044e 0%, #120322 70%)',
      cssPrimary: '#db2777',
      cssAccent: '#f472b6',
      cssGlow: 'rgba(244, 114, 182, 0.52)',
      cssBorder: 'rgba(244, 114, 182, 0.4)',
      cssSurface: 'rgba(28, 6, 38, 0.86)',
    },
    'amethyst-neon': {
      name: 'Ametista Neon',
      background: 0x040214,
      fog: 0x040214,
      ambient: 0x1e1b4b,
      shellColor: 0x312e81,
      shellEmissive: 0x3730a3,
      coreColor: 0xe0e7ff,
      coreEmissive: 0x818cf8,
      ringSecondary: 0x6366f1,
      mirrorEdge: 0x38bdf8,
      gridColor: 0x1e1b4b,
      gridEmissive: 0x312e81,
      keyLight: 0x818cf8,
      fillLight: 0x6366f1,
      rimLight: 0x22d3ee,
      dirLight: 0x38bdf8,
      particles: 0xa5b4fc,
      envStops: ['#040214', '#1e1b4b', '#4338ca', '#6366f1', '#818cf8', '#22d3ee', '#0f172a'],
      cssBg: 'radial-gradient(circle at 50% 35%, #1e1b4b 0%, #040214 70%)',
      cssPrimary: '#4f46e5',
      cssAccent: '#818cf8',
      cssGlow: 'rgba(129, 140, 248, 0.52)',
      cssBorder: 'rgba(129, 140, 248, 0.4)',
      cssSurface: 'rgba(10, 10, 38, 0.86)',
    },
  };

  if (!INTRO_THEMES[currentThemeName]) {
    currentThemeName = 'lilac-purple';
  }

  function isWebGLAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function hexToRgbNormalized(hex) {
    return {
      r: ((hex >> 16) & 255) / 255,
      g: ((hex >> 8) & 255) / 255,
      b: (hex & 255) / 255,
    };
  }

  function tweenColor(colorObj, hexValue, duration = 0.65) {
    if (!colorObj) return;
    const rgb = hexToRgbNormalized(hexValue);
    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(colorObj);
      gsap.to(colorObj, {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        duration,
        ease: 'power2.out',
        overwrite: true,
      });
    } else if (typeof colorObj.setHex === 'function') {
      colorObj.setHex(hexValue);
    }
  }

  function applyThemeCssVariables(themeKey) {
    const theme = INTRO_THEMES[themeKey] || INTRO_THEMES['lilac-purple'];
    const root = document.documentElement;
    root.style.setProperty('--purple-primary', theme.cssPrimary);
    root.style.setProperty('--purple-accent', theme.cssAccent);
    root.style.setProperty('--purple-glow', theme.cssGlow);
    root.style.setProperty('--purple-border', theme.cssBorder);
    root.style.setProperty('--purple-surface', theme.cssSurface);

    const container = document.getElementById('three-intro-container');
    if (container) {
      container.style.background = theme.cssBg;
    }

    const submitBtn = document.getElementById('auth-submit-btn');
    if (submitBtn) {
      submitBtn.style.background = `linear-gradient(135deg, ${theme.cssPrimary}, ${theme.cssAccent})`;
      submitBtn.style.borderColor = theme.cssAccent;
      submitBtn.style.boxShadow = `0 4px 18px ${theme.cssGlow}`;
    }

    document.querySelectorAll('.purple-badge').forEach((badge) => {
      badge.style.background = `linear-gradient(135deg, ${theme.cssPrimary}, ${theme.cssAccent})`;
      badge.style.boxShadow = `0 4px 20px ${theme.cssGlow}`;
    });
  }

  /**
   * Generates (and caches) a procedural high-contrast reflection map per theme
   * so mirrors ("espelhos") and glass shells reflect the selected theme colors.
   */
  function getReflectionEnvTexture(themeKey) {
    if (envTextureCache[themeKey]) return envTextureCache[themeKey];
    if (typeof THREE === 'undefined') return null;

    const theme = INTRO_THEMES[themeKey] || INTRO_THEMES['lilac-purple'];
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const stops = theme.envStops;
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.2, stops[1]);
    grad.addColorStop(0.4, stops[2]);
    grad.addColorStop(0.55, stops[3]);
    grad.addColorStop(0.7, stops[4]);
    grad.addColorStop(0.85, stops[5]);
    grad.addColorStop(1, stops[6]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    for (let i = 0; i < 48; i++) {
      const x = ((i * 97) % 512);
      const y = ((i * 53) % 256);
      const radius = (i % 3) * 0.8 + 1.0;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : stops[4];
      ctx.shadowColor = stops[3];
      ctx.shadowBlur = 6;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    envTextureCache[themeKey] = texture;
    return texture;
  }

  function initThreeScene() {
    const container = document.getElementById('three-intro-container');
    const canvas = document.getElementById('three-intro-canvas');
    if (!container || !canvas || typeof THREE === 'undefined' || !isWebGLAvailable()) {
      return false;
    }

    try {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const activeTheme = INTRO_THEMES[currentThemeName];

      // 1. SCENE & FOG
      scene = new THREE.Scene();
      scene.background = new THREE.Color(activeTheme.background);
      scene.fog = new THREE.FogExp2(activeTheme.fog, 0.035);

      const envTex = getReflectionEnvTexture(currentThemeName);
      if (envTex) {
        scene.environment = envTex;
      }

      // 2. CAMERA
      camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
      camera.position.set(0, 0.35, 7.2);

      // 3. RENDERER
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (renderer.toneMapping !== undefined) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;
      }

      clock = new THREE.Clock();

      // 4. LIGHTS
      ambientLight = new THREE.AmbientLight(activeTheme.ambient, 1.9);
      scene.add(ambientLight);

      pointLight1 = new THREE.PointLight(activeTheme.keyLight, 4.5, 35);
      pointLight1.position.set(4, 5, 5);
      scene.add(pointLight1);

      pointLight2 = new THREE.PointLight(activeTheme.fillLight, 3.8, 30);
      pointLight2.position.set(-5, -2, 4);
      scene.add(pointLight2);

      pointLight3 = new THREE.PointLight(activeTheme.rimLight, 3.2, 25);
      pointLight3.position.set(0, 4, -4);
      scene.add(pointLight3);

      dirLight = new THREE.DirectionalLight(activeTheme.dirLight, 2.2);
      dirLight.position.set(0, 8, 3);
      scene.add(dirLight);

      // 5. CENTRAL FLOATING DUAL-LAYER SPHERE
      mainSphereGroup = new THREE.Group();
      mainSphereGroup.position.set(0, 0.2, 0);

      const shellGeo = new THREE.SphereGeometry(1.45, 64, 64);
      sphereOriginalPositions = shellGeo.attributes.position.clone();

      const shellMat = new THREE.MeshPhysicalMaterial({
        color: activeTheme.shellColor,
        emissive: activeTheme.shellEmissive,
        emissiveIntensity: 0.48,
        roughness: 0.1,
        metalness: 0.22,
        transmission: 0.72,
        transparent: true,
        opacity: 0.82,
        reflectivity: 0.95,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });

      mainSphereShell = new THREE.Mesh(shellGeo, shellMat);
      mainSphereGroup.add(mainSphereShell);

      const coreGeo = new THREE.SphereGeometry(0.82, 32, 32);
      const coreMat = new THREE.MeshStandardMaterial({
        color: activeTheme.coreColor,
        emissive: activeTheme.coreEmissive,
        emissiveIntensity: 1.9,
        roughness: 0.25,
        metalness: 0.05,
      });

      mainSphereCore = new THREE.Mesh(coreGeo, coreMat);
      mainSphereGroup.add(mainSphereCore);

      mainSphereLight = new THREE.PointLight(activeTheme.coreEmissive, 2.5, 6.5);
      mainSphereGroup.add(mainSphereLight);

      const ringGeo1 = new THREE.TorusGeometry(1.9, 0.02, 16, 100);
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: activeTheme.coreEmissive,
        transparent: true,
        opacity: 0.55,
      });
      mainRing1 = new THREE.Mesh(ringGeo1, ringMat1);
      mainRing1.rotation.x = Math.PI / 3;
      mainSphereGroup.add(mainRing1);

      const ringGeo2 = new THREE.TorusGeometry(2.1, 0.015, 16, 100);
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: activeTheme.ringSecondary,
        transparent: true,
        opacity: 0.45,
      });
      mainRing2 = new THREE.Mesh(ringGeo2, ringMat2);
      mainRing2.rotation.x = -Math.PI / 3.5;
      mainRing2.rotation.y = Math.PI / 4;
      mainSphereGroup.add(mainRing2);

      scene.add(mainSphereGroup);

      // 6. SATELLITE SPHERES ("BOLAS")
      satelliteOrbs = [];
      const orbRadii = [0.38, 0.32, 0.42, 0.34];

      for (let i = 0; i < 4; i++) {
        const radius = orbRadii[i];
        const orbGroup = new THREE.Group();

        const oShellGeo = new THREE.SphereGeometry(radius, 32, 32);
        const oShellMat = new THREE.MeshPhysicalMaterial({
          color: activeTheme.shellColor,
          emissive: activeTheme.shellEmissive,
          emissiveIntensity: 0.42,
          roughness: 0.12,
          metalness: 0.2,
          transmission: 0.7,
          transparent: true,
          opacity: 0.78,
          clearcoat: 1.0,
        });
        const oShellMesh = new THREE.Mesh(oShellGeo, oShellMat);
        orbGroup.add(oShellMesh);

        const oCoreGeo = new THREE.SphereGeometry(radius * 0.52, 16, 16);
        const oCoreMat = new THREE.MeshBasicMaterial({
          color: activeTheme.coreEmissive,
        });
        const oCoreMesh = new THREE.Mesh(oCoreGeo, oCoreMat);
        orbGroup.add(oCoreMesh);

        const angle = (i / 4) * Math.PI * 2 + 0.3;
        const dist = 2.7 + (i % 2) * 0.9;
        orbGroup.userData = {
          shellMesh: oShellMesh,
          coreMesh: oCoreMesh,
          baseAngle: angle,
          orbitDistance: dist,
          orbitSpeed: 0.38 + i * 0.08,
          verticalFreq: 1.1 + i * 0.25,
          verticalAmp: 0.45 + i * 0.08,
          yOffset: -0.2 + (i % 2 === 0 ? 0.35 : -0.35),
          rotSpeedX: 0.015,
          rotSpeedY: 0.02,
        };

        scene.add(orbGroup);
        satelliteOrbs.push(orbGroup);
      }

      // 7. FLOATING MIRRORS ("ESPELHOS")
      mirrorObjects = [];

      const mirrorMat = new THREE.MeshPhysicalMaterial({
        color: 0xfdf4ff,
        metalness: 0.98,
        roughness: 0.02,
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        envMap: envTex,
        envMapIntensity: 3.0,
      });

      for (let i = 0; i < 4; i++) {
        const hexGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 6);
        const hexMesh = new THREE.Mesh(hexGeo, mirrorMat.clone());

        const edges = new THREE.EdgesGeometry(hexGeo);
        const lineMat = new THREE.LineBasicMaterial({
          color: activeTheme.mirrorEdge,
          transparent: true,
          opacity: 0.65,
        });
        const hexEdges = new THREE.LineSegments(edges, lineMat);
        hexMesh.add(hexEdges);

        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const dist = 3.3 + (i % 2) * 0.7;
        hexMesh.userData = {
          edgeLines: hexEdges,
          baseAngle: angle,
          orbitDistance: dist,
          orbitSpeed: -(0.32 + i * 0.06),
          verticalFreq: 0.9 + i * 0.2,
          verticalAmp: 0.5,
          yOffset: 0.1 + (i % 2 === 0 ? 0.4 : -0.4),
          rotSpeedX: 0.012 + i * 0.003,
          rotSpeedY: 0.016 + i * 0.004,
          rotSpeedZ: 0.008,
        };

        scene.add(hexMesh);
        mirrorObjects.push(hexMesh);
      }

      for (let i = 0; i < 4; i++) {
        const octGeo = new THREE.OctahedronGeometry(0.48, 0);
        const octMesh = new THREE.Mesh(octGeo, mirrorMat.clone());

        const edges = new THREE.EdgesGeometry(octGeo);
        const lineMat = new THREE.LineBasicMaterial({
          color: activeTheme.mirrorEdge,
          transparent: true,
          opacity: 0.7,
        });
        const octEdges = new THREE.LineSegments(edges, lineMat);
        octMesh.add(octEdges);

        const angle = (i / 4) * Math.PI * 2 + Math.PI / 2;
        const dist = 2.4 + (i % 2) * 0.8;
        octMesh.userData = {
          edgeLines: octEdges,
          baseAngle: angle,
          orbitDistance: dist,
          orbitSpeed: 0.42 + i * 0.07,
          verticalFreq: 1.3 + i * 0.2,
          verticalAmp: 0.38,
          yOffset: i % 2 === 0 ? -0.5 : 0.6,
          rotSpeedX: 0.022,
          rotSpeedY: 0.028,
          rotSpeedZ: 0.015,
        };

        scene.add(octMesh);
        mirrorObjects.push(octMesh);
      }

      for (let i = 0; i < 2; i++) {
        const slabGeo = new THREE.BoxGeometry(0.7, 1.25, 0.03);
        const slabMesh = new THREE.Mesh(slabGeo, mirrorMat.clone());

        const edges = new THREE.EdgesGeometry(slabGeo);
        const lineMat = new THREE.LineBasicMaterial({
          color: activeTheme.mirrorEdge,
          transparent: true,
          opacity: 0.6,
        });
        const slabEdges = new THREE.LineSegments(edges, lineMat);
        slabMesh.add(slabEdges);

        const angle = i * Math.PI + 0.8;
        slabMesh.userData = {
          edgeLines: slabEdges,
          baseAngle: angle,
          orbitDistance: 4.1,
          orbitSpeed: -(0.25 + i * 0.05),
          verticalFreq: 0.8,
          verticalAmp: 0.35,
          yOffset: i === 0 ? 0.3 : -0.3,
          rotSpeedX: 0.009,
          rotSpeedY: 0.014,
          rotSpeedZ: 0.006,
        };

        scene.add(slabMesh);
        mirrorObjects.push(slabMesh);
      }

      // 8. UNDULATING 3D NEON WAVE TERRAIN
      const gridWidth = 32;
      const gridDepth = 32;
      const gridSegs = 48;
      const planeGeo = new THREE.PlaneGeometry(gridWidth, gridDepth, gridSegs, gridSegs);
      planeGeo.rotateX(-Math.PI / 2.2);
      gridOriginalPositions = planeGeo.attributes.position.clone();

      const planeMat = new THREE.MeshStandardMaterial({
        color: activeTheme.gridColor,
        emissive: activeTheme.gridEmissive,
        emissiveIntensity: 0.5,
        wireframe: true,
        roughness: 0.4,
        metalness: 0.7,
        transparent: true,
        opacity: 0.75,
      });

      waveGrid = new THREE.Mesh(planeGeo, planeMat);
      waveGrid.position.set(0, -2.6, -2);
      scene.add(waveGrid);

      // 9. FLOATING STARFIELD PARTICLES
      const particleCount = 680;
      const particlePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 26;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 22;
      }

      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

      const pCanvas = document.createElement('canvas');
      pCanvas.width = 32;
      pCanvas.height = 32;
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
        const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.35, 'rgba(233, 213, 255, 0.85)');
        grad.addColorStop(0.75, 'rgba(168, 85, 247, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        pCtx.fillStyle = grad;
        pCtx.fillRect(0, 0, 32, 32);
      }

      const pTex = new THREE.CanvasTexture(pCanvas);
      const particleMat = new THREE.PointsMaterial({
        size: 0.24,
        map: pTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: activeTheme.particles,
      });

      particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      window.addEventListener('resize', onWindowResize, false);
      window.addEventListener('mousemove', onMouseMove, false);
      window.addEventListener('touchmove', onTouchMove, { passive: true });

      return true;
    } catch (err) {
      console.warn('[ThreeIntro] Error initializing Three scene:', err);
      return false;
    }
  }

  /**
   * Switches the 3D Intro Gradient Color Theme reliably across WebGL + CSS UI
   */
  function setIntro3DTheme(themeKey) {
    if (!INTRO_THEMES[themeKey]) return;
    currentThemeName = themeKey;
    try {
      localStorage.setItem('synccord_intro_3d_theme', themeKey);
    } catch {}

    const theme = INTRO_THEMES[themeKey];

    // 1. Update active UI pill immediately
    document.querySelectorAll('.intro-gradient-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.getAttribute('data-theme') === themeKey);
    });

    // 2. Update CSS variables & frosted card / buttons (works even without WebGL)
    applyThemeCssVariables(themeKey);

    if (!scene) return;

    // 3. Update environment reflection map on scene & mirrors
    const envTex = getReflectionEnvTexture(themeKey);
    if (envTex) {
      scene.environment = envTex;
      mirrorObjects.forEach((m) => {
        if (m.material) {
          m.material.envMap = envTex;
          m.material.needsUpdate = true;
        }
      });
    }

    // 4. Smoothly transition all 3D lights, background, fog, sphere, orbs, mirrors, grid & particles
    tweenColor(scene.background, theme.background, 0.7);
    if (scene.fog) tweenColor(scene.fog.color, theme.fog, 0.7);
    if (ambientLight) tweenColor(ambientLight.color, theme.ambient, 0.7);
    if (pointLight1) tweenColor(pointLight1.color, theme.keyLight, 0.7);
    if (pointLight2) tweenColor(pointLight2.color, theme.fillLight, 0.7);
    if (pointLight3) tweenColor(pointLight3.color, theme.rimLight, 0.7);
    if (dirLight) tweenColor(dirLight.color, theme.dirLight, 0.7);

    if (mainSphereShell && mainSphereShell.material) {
      tweenColor(mainSphereShell.material.color, theme.shellColor, 0.7);
      tweenColor(mainSphereShell.material.emissive, theme.shellEmissive, 0.7);
    }
    if (mainSphereCore && mainSphereCore.material) {
      tweenColor(mainSphereCore.material.color, theme.coreColor, 0.7);
      tweenColor(mainSphereCore.material.emissive, theme.coreEmissive, 0.7);
    }
    if (mainSphereLight) {
      tweenColor(mainSphereLight.color, theme.coreEmissive, 0.7);
    }
    if (mainRing1 && mainRing1.material) {
      tweenColor(mainRing1.material.color, theme.coreEmissive, 0.7);
    }
    if (mainRing2 && mainRing2.material) {
      tweenColor(mainRing2.material.color, theme.ringSecondary, 0.7);
    }

    satelliteOrbs.forEach((orb) => {
      const { shellMesh, coreMesh } = orb.userData || {};
      if (shellMesh && shellMesh.material) {
        tweenColor(shellMesh.material.color, theme.shellColor, 0.7);
        tweenColor(shellMesh.material.emissive, theme.shellEmissive, 0.7);
      }
      if (coreMesh && coreMesh.material) {
        tweenColor(coreMesh.material.color, theme.coreEmissive, 0.7);
      }
    });

    mirrorObjects.forEach((mirror) => {
      const edgeLines = mirror.userData?.edgeLines;
      if (edgeLines && edgeLines.material) {
        tweenColor(edgeLines.material.color, theme.mirrorEdge, 0.7);
      }
    });

    if (waveGrid && waveGrid.material) {
      tweenColor(waveGrid.material.color, theme.gridColor, 0.7);
      tweenColor(waveGrid.material.emissive, theme.gridEmissive, 0.7);
    }

    if (particles && particles.material) {
      tweenColor(particles.material.color, theme.particles, 0.7);
    }
  }

  /**
   * Animates Auth Modal upward to fade out completely while elevating the 3D scene
   */
  const MODAL_HIDE_DISTANCE = 250;

  function dismissModalUpward() {
    const hero = document.getElementById('three-intro-hero');
    const authModal = document.getElementById('auth-modal');
    if (!authModal) return;

    if (introTimeline) {
      introTimeline.kill();
      introTimeline = null;
    }

    isModalDismissedUp = true;
    authModal.style.pointerEvents = 'none';

    const stateProxy = { p: dragProgress };
    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(authModal);
      if (hero) gsap.killTweensOf(hero);

      gsap.to(stateProxy, {
        p: 1,
        duration: 0.42,
        ease: 'power3.out',
        onUpdate: () => {
          dragProgress = stateProxy.p;
        },
      });

      gsap.to(authModal, {
        y: -MODAL_HIDE_DISTANCE,
        opacity: 0,
        scale: 0.92,
        duration: 0.42,
        ease: 'power3.out',
      });

      if (hero) {
        gsap.to(hero, {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.45,
          ease: 'power2.out',
        });
      }
    } else {
      dragProgress = 1;
      authModal.style.transform = `translateY(${-MODAL_HIDE_DISTANCE}px) scale(0.92)`;
      authModal.style.opacity = '0';
      if (hero) {
        hero.style.transform = 'translateY(0px) scale(1)';
        hero.style.opacity = '1';
      }
    }
  }

  /**
   * Restores Auth Modal smoothly back to the center of the screen
   */
  function restoreModalToCenter() {
    const hero = document.getElementById('three-intro-hero');
    const authModal = document.getElementById('auth-modal');
    if (!authModal) return;

    if (introTimeline) {
      introTimeline.kill();
      introTimeline = null;
    }

    isModalDismissedUp = false;
    authModal.style.display = 'flex';
    authModal.style.pointerEvents = 'auto';
    authModal.classList.add('open');

    const stateProxy = { p: dragProgress };
    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(authModal);
      if (hero) gsap.killTweensOf(hero);

      gsap.to(stateProxy, {
        p: 0,
        duration: 0.48,
        ease: 'power3.out',
        onUpdate: () => {
          dragProgress = stateProxy.p;
        },
      });

      gsap.to(authModal, {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: 'back.out(1.15)',
      });

      if (hero) {
        gsap.to(hero, {
          y: -26,
          opacity: 0.82,
          scale: 0.95,
          duration: 0.45,
          ease: 'power2.out',
        });
      }
    } else {
      dragProgress = 0;
      authModal.style.transform = 'translateY(0px) scale(1)';
      authModal.style.opacity = '1';
      if (hero) {
        hero.style.opacity = '0.82';
      }
    }
  }

  /**
   * Binds reliable Theme Pill clicks AND Left-Click Vertical Drag on Modal / Stage:
   * - Left-click on modal + move UP -> modal fades out upward ("vai sumindo")
   * - Left-click + move DOWN -> modal returns smoothly to the center ("volta para o centro")
   */
  function bindIntroInteractiveEvents() {
    if (domEventsBound) return;
    const container = document.getElementById('three-intro-container');
    const selector = document.getElementById('intro-gradient-selector');
    const authModal = document.getElementById('auth-modal');
    const hero = document.getElementById('three-intro-hero');
    if (!container || !authModal) return;

    domEventsBound = true;

    // 1. Reliable delegated listener on theme selector pills
    if (selector) {
      selector.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      selector.addEventListener('click', (e) => {
        const pill = e.target.closest('.intro-gradient-pill');
        if (!pill) return;
        e.preventDefault();
        e.stopPropagation();
        const themeKey = pill.getAttribute('data-theme');
        if (themeKey) {
          setIntro3DTheme(themeKey);
        }
      });
    }

    // 2. Left-button vertical drag interaction
    let dragActive = false;
    let dragStarted = false;
    let dragMode = null; // 'from-modal' | 'pull-down'
    let startClientY = 0;
    let baseModalY = 0;
    let currentModalY = 0;
    let lastClientY = 0;
    let lastMoveTime = 0;
    let velocityY = 0;
    let suppressClickUntil = 0;

    // Prevent stray clicks right after finishing a drag gesture
    container.addEventListener(
      'click',
      (e) => {
        if (Date.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );

    // Start drag from inside #auth-modal (left mouse button only: e.button === 0)
    authModal.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('input, textarea, select')) return;

      dragActive = true;
      dragStarted = false;
      dragMode = 'from-modal';
      startClientY = e.clientY;
      lastClientY = e.clientY;
      lastMoveTime = performance.now();
      velocityY = 0;
      baseModalY = typeof gsap !== 'undefined' ? Number(gsap.getProperty(authModal, 'y')) || 0 : 0;
      currentModalY = baseModalY;
    });

    // Start pull-down drag anywhere on #three-intro-container when modal is dismissed up (or during intro)
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.intro-gradient-selector')) return;
      if (e.target.closest('#auth-modal') && !isModalDismissedUp) return;

      dragActive = true;
      dragStarted = false;
      dragMode = 'pull-down';
      startClientY = e.clientY;
      lastClientY = e.clientY;
      lastMoveTime = performance.now();
      velocityY = 0;
      baseModalY = isModalDismissedUp ? -MODAL_HIDE_DISTANCE : (typeof gsap !== 'undefined' ? Number(gsap.getProperty(authModal, 'y')) || 0 : 0);
      currentModalY = baseModalY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragActive) return;

      const dy = e.clientY - startClientY;
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveTime);
      velocityY = (e.clientY - lastClientY) / dt;
      lastClientY = e.clientY;
      lastMoveTime = now;

      if (!dragStarted) {
        if (Math.abs(dy) < 7) return;
        // In pull-down mode from background, only engage when dragging downward (or if modal isn't open yet)
        if (dragMode === 'pull-down' && dy < 0 && isModalDismissedUp) return;

        dragStarted = true;
        if (introTimeline) {
          introTimeline.kill();
          introTimeline = null;
        }
        if (typeof gsap !== 'undefined') {
          gsap.killTweensOf(authModal);
          if (hero) gsap.killTweensOf(hero);
        }
        authModal.style.display = 'flex';
        authModal.classList.add('open', 'is-dragging');
      }

      e.preventDefault();

      let rawY = baseModalY + dy;
      if (rawY > 0) {
        // Gentle elastic resistance below center
        rawY = rawY * 0.18;
      }
      currentModalY = Math.max(-MODAL_HIDE_DISTANCE * 1.2, Math.min(36, rawY));

      // Progress: 0 at center (y >= 0), 1 when pushed upward to -MODAL_HIDE_DISTANCE
      const progress = Math.min(1, Math.max(0, -currentModalY / MODAL_HIDE_DISTANCE));
      dragProgress = progress;

      const opacity = Math.max(0, Math.min(1, 1 - progress));
      const scale = 1 - progress * 0.08;

      if (typeof gsap !== 'undefined') {
        gsap.set(authModal, { y: currentModalY, opacity, scale });
        if (hero) {
          gsap.set(hero, {
            y: -26 * (1 - progress),
            opacity: 0.82 + 0.18 * progress,
            scale: 0.95 + 0.05 * progress,
          });
        }
      } else {
        authModal.style.transform = `translateY(${currentModalY}px) scale(${scale})`;
        authModal.style.opacity = String(opacity);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!dragActive) return;
      if (e.button !== 0 && dragStarted === false) {
        dragActive = false;
        return;
      }

      const wasDragging = dragStarted;
      const mode = dragMode;
      const totalDy = e.clientY - startClientY;
      dragActive = false;
      dragStarted = false;
      dragMode = null;
      authModal.classList.remove('is-dragging');

      if (!wasDragging) return;

      suppressClickUntil = Date.now() + 120;

      if (mode === 'from-modal') {
        // Dragged/flicked upward -> complete smooth fade-out upward
        if (currentModalY < -70 || (totalDy < -25 && velocityY < -0.35)) {
          dismissModalUpward();
        } else {
          restoreModalToCenter();
        }
      } else if (mode === 'pull-down') {
        // Dragged downward -> bring smoothly back to center
        if (totalDy > 35 || velocityY > 0.25 || currentModalY > -MODAL_HIDE_DISTANCE * 0.7) {
          restoreModalToCenter();
        } else {
          dismissModalUpward();
        }
      }
    });
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function onMouseMove(e) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function onTouchMove(e) {
    if (e.touches && e.touches.length > 0) {
      mouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
      mouseY = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
  }

  // Animation render loop
  function animate() {
    if (!isRunning) return;
    animationFrameId = requestAnimationFrame(animate);

    const time = clock ? clock.getElapsedTime() : performance.now() * 0.001;

    // 1. Mouse Camera Parallax + interactive response to vertical modal drag
    targetCameraX = mouseX * 1.3;
    targetCameraY = mouseY * 0.85 + dragProgress * 0.35;
    const targetCameraZ = 7.2 - dragProgress * 0.85;
    camera.position.x += (targetCameraX - camera.position.x) * 0.04;
    camera.position.y += (0.35 + targetCameraY - camera.position.y) * 0.04;
    camera.position.z += (targetCameraZ - camera.position.z) * 0.05;
    camera.lookAt(0, dragProgress * 0.15, 0);

    // 2. Central Dual-Layer Sphere: Shell Morph + Inner Core Pulsing + Drag Reaction
    if (mainSphereGroup) {
      mainSphereGroup.rotation.y = time * 0.22 + dragProgress * 0.45;
      mainSphereGroup.rotation.x = Math.sin(time * 0.3) * 0.12 - dragProgress * 0.15;
      mainSphereGroup.position.y = 0.2 + Math.sin(time * 1.2) * 0.12 + dragProgress * 0.18;

      const groupScale = 1 + dragProgress * 0.12;
      mainSphereGroup.scale.set(groupScale, groupScale, groupScale);

      if (mainSphereCore) {
        const pulse = 1.0 + Math.sin(time * 2.4) * 0.09;
        mainSphereCore.scale.set(pulse, pulse, pulse);
        mainSphereCore.rotation.y = -time * 0.4;
      }

      if (mainSphereShell && sphereOriginalPositions) {
        const pos = mainSphereShell.geometry.attributes.position;
        const orig = sphereOriginalPositions;
        const count = pos.count;

        for (let i = 0; i < count; i++) {
          const ox = orig.getX(i);
          const oy = orig.getY(i);
          const oz = orig.getZ(i);

          const wave =
            Math.sin(ox * 2.5 + time * 2.2) *
            Math.cos(oy * 2.5 + time * 1.8) *
            Math.sin(oz * 2.0 + time * 1.4) *
            0.08;

          pos.setXYZ(i, ox * (1 + wave), oy * (1 + wave), oz * (1 + wave));
        }
        pos.needsUpdate = true;
        mainSphereShell.geometry.computeVertexNormals();
      }
    }

    // 3. Orbit Satellite Spheres ("Bolas")
    satelliteOrbs.forEach((orb) => {
      const d = orb.userData;
      const currentAngle = d.baseAngle + time * d.orbitSpeed;
      orb.position.x = Math.cos(currentAngle) * d.orbitDistance;
      orb.position.z = Math.sin(currentAngle) * d.orbitDistance;
      orb.position.y = d.yOffset + Math.sin(time * d.verticalFreq) * d.verticalAmp;

      orb.rotation.x += d.rotSpeedX;
      orb.rotation.y += d.rotSpeedY;
    });

    // 4. Orbit & Rotate Floating Mirrors ("Espelhos")
    mirrorObjects.forEach((mirror) => {
      const d = mirror.userData;
      const currentAngle = d.baseAngle + time * d.orbitSpeed;
      mirror.position.x = Math.cos(currentAngle) * d.orbitDistance;
      mirror.position.z = Math.sin(currentAngle) * d.orbitDistance;
      mirror.position.y = d.yOffset + Math.sin(time * d.verticalFreq) * d.verticalAmp;

      mirror.rotation.x += d.rotSpeedX;
      mirror.rotation.y += d.rotSpeedY;
      mirror.rotation.z += d.rotSpeedZ;
    });

    // 5. Undulate 3D Wave Terrain Grid
    if (waveGrid && gridOriginalPositions) {
      const pos = waveGrid.geometry.attributes.position;
      const orig = gridOriginalPositions;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        const ox = orig.getX(i);
        const oy = orig.getY(i);

        const zWave =
          Math.sin(ox * 0.35 + time * 1.6) * Math.cos(oy * 0.35 + time * 1.4) * 0.55 +
          Math.sin((ox + oy) * 0.2 + time * 2.0) * 0.25;

        pos.setZ(i, orig.getZ(i) + zWave);
      }
      pos.needsUpdate = true;
    }

    // 6. Rotate Particles
    if (particles) {
      particles.rotation.y = time * 0.035;
      particles.rotation.x = Math.sin(time * 0.02) * 0.05;
    }

    renderer.render(scene, camera);
  }

  function startRenderLoop() {
    if (isRunning) return;
    isRunning = true;
    if (clock) clock.start();
    animate();
  }

  function stopRenderLoop() {
    isRunning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * Shows the 3D Purple & Lilac Intro Experience with GSAP
   */
  function showThreeIntro() {
    const container = document.getElementById('three-intro-container');
    const hero = document.getElementById('three-intro-hero');
    const authModal = document.getElementById('auth-modal');

    if (!container) return;

    container.style.display = 'flex';
    container.style.opacity = '1';
    isModalDismissedUp = false;
    dragProgress = 0;

    bindIntroInteractiveEvents();

    let initialized = true;
    if (!scene) {
      initialized = initThreeScene();
    }

    // Ensure saved/current theme is applied visually on both pills, CSS, and 3D objects
    setIntro3DTheme(currentThemeName);

    if (initialized) {
      startRenderLoop();
    }

    if (typeof gsap !== 'undefined') {
      if (introTimeline) {
        introTimeline.kill();
      }
      introTimeline = gsap.timeline();

      if (hero) {
        gsap.set(hero, { opacity: 0, scale: 0.85, y: 30 });
      }
      if (authModal) {
        authModal.classList.remove('open');
        authModal.style.pointerEvents = 'auto';
        gsap.set(authModal, { opacity: 0, scale: 0.92, y: 50, display: 'none' });
      }

      if (hero) {
        introTimeline.to(hero, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
        });
      }

      introTimeline.to(
        hero,
        {
          y: -26,
          opacity: 0.82,
          scale: 0.95,
          duration: 0.65,
          ease: 'power2.inOut',
        },
        '+=0.35',
      );

      introTimeline.call(() => {
        if (authModal && !isModalDismissedUp) {
          authModal.style.display = 'flex';
          authModal.style.pointerEvents = 'auto';
          authModal.classList.add('open');
        }
      });

      introTimeline.to(
        authModal,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.75,
          ease: 'back.out(1.15)',
        },
        '<',
      );
    } else {
      if (hero) hero.style.opacity = '1';
      setTimeout(() => {
        if (authModal && !isModalDismissedUp) {
          authModal.style.display = 'flex';
          authModal.style.pointerEvents = 'auto';
          authModal.classList.add('open');
          authModal.style.opacity = '1';
        }
      }, 1200);
    }
  }

  function dismissThreeIntro() {
    const container = document.getElementById('three-intro-container');
    if (!container) return;

    if (introTimeline) {
      introTimeline.kill();
      introTimeline = null;
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(container, {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.inOut',
        onComplete: () => {
          container.style.display = 'none';
          stopRenderLoop();
        },
      });
    } else {
      container.style.display = 'none';
      stopRenderLoop();
    }
  }

  window.showThreeIntro = showThreeIntro;
  window.dismissThreeIntro = dismissThreeIntro;
  window.startThreeIntro = showThreeIntro;
  window.setIntro3DTheme = setIntro3DTheme;
  window.dismissAuthModalUpward = dismissModalUpward;
  window.restoreAuthModalToCenter = restoreModalToCenter;
})();
