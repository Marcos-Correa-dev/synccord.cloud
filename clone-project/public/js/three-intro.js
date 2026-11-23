/**
 * SyncCord Three.js + GSAP 3D Purple & Lilac Experience
 * Features:
 * - Spheres ("Bolas") with translucent crystal purple outer shell and radiant glowing Lilac inner core
 * - Mirrors ("Espelhos"): floating high-reflectivity mirror facets (hexagons, diamond octahedrons, rectangular mirror slabs)
 * - Procedural Purple/Lilac environment reflection map for realistic specular mirror reflections
 * - Undulating 3D wave grid / neon purple terrain
 * - Floating particle nebula / starfield
 * - Interactive 3D Gradient Theme Switcher (Lilás & Púrpura, Ciber Violeta, Ametista Neon)
 * - Interactive mouse parallax camera tracking
 * - GSAP cinematic timeline: 3D scene reveals -> modal gracefully appears
 */

(function () {
  'use strict';

  let scene, camera, renderer;
  let mainSphereGroup, mainSphereShell, mainSphereCore, mainSphereLight;
  let satelliteOrbs = [];
  let mirrorObjects = [];
  let waveGrid, particles;
  let animationFrameId = null;
  let isRunning = false;
  let mouseX = 0, mouseY = 0;
  let targetCameraX = 0, targetCameraY = 0;
  let clock;
  let gridOriginalPositions = null;
  let sphereOriginalPositions = null;
  let currentThemeName = 'lilac-purple';
  let envReflectionTexture = null;

  // Theme color configurations
  const INTRO_THEMES = {
    'lilac-purple': {
      name: 'Lilás & Púrpura',
      background: 0x090314,
      fog: 0x090314,
      shellColor: 0x6d28d9,
      shellEmissive: 0x3b0764,
      coreColor: 0xf3e8ff,
      coreEmissive: 0xd8b4fe,
      mirrorEdge: 0xd8b4fe,
      keyLight: 0xc084fc,
      fillLight: 0x9333ea,
      rimLight: 0xf472b6,
      particles: 0xd8b4fe,
    },
    'cyber-violet': {
      name: 'Ciber Violeta',
      background: 0x0b0217,
      fog: 0x0b0217,
      shellColor: 0x4c1d95,
      shellEmissive: 0x581c87,
      coreColor: 0xfdf4ff,
      coreEmissive: 0xf472b6,
      mirrorEdge: 0xf472b6,
      keyLight: 0xe879f9,
      fillLight: 0x7c3aed,
      rimLight: 0x38bdf8,
      particles: 0xf0abfc,
    },
    'amethyst-neon': {
      name: 'Ametista Neon',
      background: 0x05010d,
      fog: 0x05010d,
      shellColor: 0x240046,
      shellEmissive: 0x3c096c,
      coreColor: 0xffffff,
      coreEmissive: 0xc084fc,
      mirrorEdge: 0xa855f7,
      keyLight: 0xa855f7,
      fillLight: 0x6b21a8,
      rimLight: 0x818cf8,
      particles: 0xc084fc,
    },
  };

  function isWebGLAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  /**
   * Generates a procedural high-contrast purple & lilac equirectangular reflection map
   * so mirrors ("espelhos") and glass shells reflect rich cyber gradients and stars.
   */
  function createReflectionEnvTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Rich gradient: Deep purple -> vibrant violet -> radiant lilac -> fuchsia accent
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#090314');
    grad.addColorStop(0.2, '#3b0764');
    grad.addColorStop(0.4, '#7c3aed');
    grad.addColorStop(0.55, '#c084fc');
    grad.addColorStop(0.7, '#d8b4fe');
    grad.addColorStop(0.85, '#ec4899');
    grad.addColorStop(1, '#1e0836');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Specular star glints on reflection map
    for (let i = 0; i < 48; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      const radius = Math.random() * 2.5 + 0.8;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : (i % 2 === 0 ? '#f3e8ff' : '#d8b4fe');
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 6;
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }

  function initThreeScene() {
    const container = document.getElementById('three-intro-container');
    const canvas = document.getElementById('three-intro-canvas');
    if (!container || !canvas || typeof THREE === 'undefined' || !isWebGLAvailable()) {
      console.warn('[ThreeIntro] THREE, canvas container or WebGL context not available. Falling back.');
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

      // Environment reflection map for mirrors and glass
      envReflectionTexture = createReflectionEnvTexture();
      if (envReflectionTexture) {
        scene.environment = envReflectionTexture;
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

      // 4. LIGHTS (Deep cyber purple key light, electric violet fill, fuchsia rim)
      const ambientLight = new THREE.AmbientLight(0x2e1065, 1.9);
      scene.add(ambientLight);

      // Main lilac/purple key light
      const pointLight1 = new THREE.PointLight(activeTheme.keyLight, 4.5, 35);
      pointLight1.position.set(4, 5, 5);
      scene.add(pointLight1);

      // Deep neon violet fill light
      const pointLight2 = new THREE.PointLight(activeTheme.fillLight, 3.8, 30);
      pointLight2.position.set(-5, -2, 4);
      scene.add(pointLight2);

      // Fuchsia/magenta accent rim light
      const pointLight3 = new THREE.PointLight(activeTheme.rimLight, 3.2, 25);
      pointLight3.position.set(0, 4, -4);
      scene.add(pointLight3);

      // Cyan-violet directional backlight
      const dirLight = new THREE.DirectionalLight(0x818cf8, 2.2);
      dirLight.position.set(0, 8, 3);
      scene.add(dirLight);

      // 5. CENTRAL FLOATING DUAL-LAYER SPHERE ("BOLA COM INTERIOR LILÁS")
      mainSphereGroup = new THREE.Group();
      mainSphereGroup.position.set(0, 0.2, 0);

      // A. Outer Translucent Crystal Purple Shell (Morphing liquid surface)
      const shellGeo = new THREE.SphereGeometry(1.45, 64, 64);
      sphereOriginalPositions = shellGeo.attributes.position.clone();

      const shellMat = new THREE.MeshPhysicalMaterial({
        color: activeTheme.shellColor,
        emissive: activeTheme.shellEmissive,
        emissiveIntensity: 0.45,
        roughness: 0.1,
        metalness: 0.22,
        transmission: 0.72,
        transparent: true,
        opacity: 0.8,
        reflectivity: 0.95,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });

      mainSphereShell = new THREE.Mesh(shellGeo, shellMat);
      mainSphereGroup.add(mainSphereShell);

      // B. Inner Radiant Lilac Glowing Core ("Aspecto Purple, Lilás por Dentro")
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

      // C. Inner Point Light illuminating through the shell
      mainSphereLight = new THREE.PointLight(activeTheme.coreEmissive, 2.5, 6.5);
      mainSphereGroup.add(mainSphereLight);

      // D. Concentric Glowing Neon Rings around Main Sphere
      const ringGeo1 = new THREE.TorusGeometry(1.9, 0.02, 16, 100);
      const ringMat1 = new THREE.MeshBasicMaterial({
        color: activeTheme.coreEmissive,
        transparent: true,
        opacity: 0.5,
      });
      const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
      ring1.rotation.x = Math.PI / 3;
      mainSphereGroup.add(ring1);

      const ringGeo2 = new THREE.TorusGeometry(2.1, 0.015, 16, 100);
      const ringMat2 = new THREE.MeshBasicMaterial({
        color: 0x9333ea,
        transparent: true,
        opacity: 0.4,
      });
      const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
      ring2.rotation.x = -Math.PI / 3.5;
      ring2.rotation.y = Math.PI / 4;
      mainSphereGroup.add(ring2);

      scene.add(mainSphereGroup);

      // 6. SATELLITE SPHERES ("BOLAS") WITH INNER LILAC NUCLEI
      satelliteOrbs = [];
      const orbRadii = [0.38, 0.32, 0.42, 0.34];

      for (let i = 0; i < 4; i++) {
        const radius = orbRadii[i];
        const orbGroup = new THREE.Group();

        // Outer translucent purple glass shell
        const oShellGeo = new THREE.SphereGeometry(radius, 32, 32);
        const oShellMat = new THREE.MeshPhysicalMaterial({
          color: activeTheme.shellColor,
          emissive: activeTheme.shellEmissive,
          emissiveIntensity: 0.4,
          roughness: 0.12,
          metalness: 0.2,
          transmission: 0.7,
          transparent: true,
          opacity: 0.78,
          clearcoat: 1.0,
        });
        const oShellMesh = new THREE.Mesh(oShellGeo, oShellMat);
        orbGroup.add(oShellMesh);

        // Inner glowing lilac nucleus
        const oCoreGeo = new THREE.SphereGeometry(radius * 0.52, 16, 16);
        const oCoreMat = new THREE.MeshBasicMaterial({
          color: activeTheme.coreEmissive,
        });
        const oCoreMesh = new THREE.Mesh(oCoreGeo, oCoreMat);
        orbGroup.add(oCoreMesh);

        const angle = (i / 4) * Math.PI * 2 + 0.3;
        const dist = 2.7 + (i % 2) * 0.9;
        orbGroup.userData = {
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
      // High-reflectivity chrome mirrors reflecting the purple & lilac scene
      mirrorObjects = [];

      const mirrorMat = new THREE.MeshPhysicalMaterial({
        color: 0xfdf4ff,
        metalness: 0.98,
        roughness: 0.02,
        reflectivity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        envMap: envReflectionTexture,
        envMapIntensity: 3.0,
      });

      // Type A: 4 Mirrored Hexagonal Reflector Plates
      for (let i = 0; i < 4; i++) {
        const hexGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 6);
        const hexMesh = new THREE.Mesh(hexGeo, mirrorMat.clone());

        // Glowing lilac beveled edge line
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
          baseAngle: angle,
          orbitDistance: dist,
          orbitSpeed: -(0.32 + i * 0.06),
          verticalFreq: 0.9 + i * 0.2,
          verticalAmp: 0.5,
          yOffset: 0.1 + (i % 2 === 0 ? 0.4 : -0.4),
          rotSpeedX: 0.012 + (i * 0.003),
          rotSpeedY: 0.016 + (i * 0.004),
          rotSpeedZ: 0.008,
        };

        scene.add(hexMesh);
        mirrorObjects.push(hexMesh);
      }

      // Type B: 4 Mirrored Diamond Octahedrons (Faceted mirror crystals)
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
          baseAngle: angle,
          orbitDistance: dist,
          orbitSpeed: 0.42 + (i * 0.07),
          verticalFreq: 1.3 + (i * 0.2),
          verticalAmp: 0.38,
          yOffset: (i % 2 === 0 ? -0.5 : 0.6),
          rotSpeedX: 0.022,
          rotSpeedY: 0.028,
          rotSpeedZ: 0.015,
        };

        scene.add(octMesh);
        mirrorObjects.push(octMesh);
      }

      // Type C: 2 Mirrored Rectangular Floating Monolith Slabs
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

      // 8. UNDULATING 3D NEON PURPLE WAVE TERRAIN (Grid / Ribbons)
      const gridWidth = 32;
      const gridDepth = 32;
      const gridSegs = 48;
      const planeGeo = new THREE.PlaneGeometry(gridWidth, gridDepth, gridSegs, gridSegs);
      planeGeo.rotateX(-Math.PI / 2.2);
      gridOriginalPositions = planeGeo.attributes.position.clone();

      const planeMat = new THREE.MeshStandardMaterial({
        color: 0x1e0836,
        emissive: 0x3b0764,
        emissiveIntensity: 0.45,
        wireframe: true,
        roughness: 0.4,
        metalness: 0.7,
        transparent: true,
        opacity: 0.75,
      });

      waveGrid = new THREE.Mesh(planeGeo, planeMat);
      waveGrid.position.set(0, -2.6, -2);
      scene.add(waveGrid);

      // 9. PURPLE & LILAC FLOATING STARFIELD PARTICLES
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
        grad.addColorStop(0, 'rgba(243, 232, 255, 1)');
        grad.addColorStop(0.35, 'rgba(216, 180, 254, 0.85)');
        grad.addColorStop(0.75, 'rgba(124, 58, 237, 0.25)');
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

      // 10. EVENT LISTENERS
      window.addEventListener('resize', onWindowResize, false);
      window.addEventListener('mousemove', onMouseMove, false);
      window.addEventListener('touchmove', onTouchMove, { passive: true });

      // Quick background click reveals modal immediately
      container.addEventListener('click', (e) => {
        if (
          e.target === container ||
          e.target === canvas ||
          e.target.id === 'three-intro-hero' ||
          (e.target.closest('#three-intro-hero') && !e.target.closest('.intro-gradient-selector'))
        ) {
          revealModalInstantly();
        }
      });

      return true;
    } catch (err) {
      console.warn('[ThreeIntro] Error initializing Three scene:', err);
      return false;
    }
  }

  /**
   * Switches the 3D Intro Gradient Color Theme dynamically
   */
  function setIntro3DTheme(themeKey) {
    if (!INTRO_THEMES[themeKey]) return;
    currentThemeName = themeKey;
    const theme = INTRO_THEMES[themeKey];

    // Update active UI pill
    document.querySelectorAll('.intro-gradient-pill').forEach((pill) => {
      if (pill.getAttribute('data-theme') === themeKey) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    if (!scene) return;

    if (typeof gsap !== 'undefined') {
      if (mainSphereShell && mainSphereShell.material) {
        gsap.to(mainSphereShell.material.color, {
          r: ((theme.shellColor >> 16) & 255) / 255,
          g: ((theme.shellColor >> 8) & 255) / 255,
          b: (theme.shellColor & 255) / 255,
          duration: 0.8,
        });
      }
      if (mainSphereCore && mainSphereCore.material) {
        gsap.to(mainSphereCore.material.emissive, {
          r: ((theme.coreEmissive >> 16) & 255) / 255,
          g: ((theme.coreEmissive >> 8) & 255) / 255,
          b: (theme.coreEmissive & 255) / 255,
          duration: 0.8,
        });
      }
      if (mainSphereLight) {
        gsap.to(mainSphereLight.color, {
          r: ((theme.coreEmissive >> 16) & 255) / 255,
          g: ((theme.coreEmissive >> 8) & 255) / 255,
          b: (theme.coreEmissive & 255) / 255,
          duration: 0.8,
        });
      }
    } else {
      if (mainSphereShell && mainSphereShell.material) {
        mainSphereShell.material.color.setHex(theme.shellColor);
      }
      if (mainSphereCore && mainSphereCore.material) {
        mainSphereCore.material.emissive.setHex(theme.coreEmissive);
      }
      if (mainSphereLight) {
        mainSphereLight.color.setHex(theme.coreEmissive);
      }
    }
  }

  function revealModalInstantly() {
    const hero = document.getElementById('three-intro-hero');
    const authModal = document.getElementById('auth-modal');
    if (!authModal) return;

    if (typeof gsap !== 'undefined') {
      if (hero) gsap.to(hero, { y: -40, opacity: 0.65, scale: 0.92, duration: 0.35 });
      authModal.style.display = 'flex';
      authModal.classList.add('open');
      gsap.to(authModal, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power2.out' });
    } else {
      if (hero) hero.style.opacity = '0.65';
      authModal.style.display = 'flex';
      authModal.classList.add('open');
      authModal.style.opacity = '1';
    }
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

    // 1. Mouse Camera Parallax (smooth dampening)
    targetCameraX = mouseX * 1.3;
    targetCameraY = mouseY * 0.85;
    camera.position.x += (targetCameraX - camera.position.x) * 0.04;
    camera.position.y += (0.35 + targetCameraY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    // 2. Central Dual-Layer Sphere: Shell Morph + Inner Lilac Core Pulsing
    if (mainSphereGroup) {
      mainSphereGroup.rotation.y = time * 0.22;
      mainSphereGroup.rotation.x = Math.sin(time * 0.3) * 0.12;
      mainSphereGroup.position.y = 0.2 + Math.sin(time * 1.2) * 0.12;

      // Inner Lilac Core pulsating radiance
      if (mainSphereCore) {
        const pulse = 1.0 + Math.sin(time * 2.4) * 0.09;
        mainSphereCore.scale.set(pulse, pulse, pulse);
        mainSphereCore.rotation.y = -time * 0.4;
      }

      // Outer Shell organic harmonic ripples
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

      // Mirrors rotate on multiple axes catching specular reflections
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

  // Starts the WebGL rendering
  function startRenderLoop() {
    if (isRunning) return;
    isRunning = true;
    if (clock) clock.start();
    animate();
  }

  // Stops the WebGL rendering to save battery & GPU
  function stopRenderLoop() {
    isRunning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  /**
   * Shows the 3D Purple & Lilac Intro Experience with GSAP:
   * 1. 3D Canvas & Hero reveal
   * 2. After ~1.6 seconds, the Login Modal floats in gracefully
   */
  function showThreeIntro() {
    const container = document.getElementById('three-intro-container');
    const hero = document.getElementById('three-intro-hero');
    const authModal = document.getElementById('auth-modal');

    if (!container) return;

    container.style.display = 'flex';
    container.style.opacity = '1';

    let initialized = true;
    if (!scene) {
      initialized = initThreeScene();
    }

    if (initialized) {
      startRenderLoop();
    }

    // GSAP Cinematic Entrance Sequence
    if (typeof gsap !== 'undefined') {
      const tl = gsap.timeline();

      // Reset initial styles
      if (hero) {
        gsap.set(hero, { opacity: 0, scale: 0.85, y: 30 });
      }
      if (authModal) {
        authModal.classList.remove('open');
        gsap.set(authModal, { opacity: 0, scale: 0.92, y: 50, display: 'none' });
      }

      // Step 1: Reveal Hero Branding (0s -> 1.0s)
      if (hero) {
        tl.to(hero, {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1.0,
          ease: 'power3.out',
        });
      }

      // Step 2: Elevate Hero & Gracefully Float In Login Modal (at ~1.5s)
      tl.to(
        hero,
        {
          y: -30,
          opacity: 0.72,
          scale: 0.94,
          duration: 0.7,
          ease: 'power2.inOut',
        },
        '+=0.5'
      );

      tl.call(() => {
        if (authModal) {
          authModal.style.display = 'flex';
          authModal.classList.add('open');
        }
      });

      tl.to(
        authModal,
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.85,
          ease: 'back.out(1.15)',
        },
        '<'
      );
    } else {
      // Fallback without GSAP
      if (hero) hero.style.opacity = '1';
      setTimeout(() => {
        if (authModal) {
          authModal.style.display = 'flex';
          authModal.classList.add('open');
          authModal.style.opacity = '1';
        }
      }, 1500);
    }
  }

  /**
   * Smoothly dismisses the 3D Intro Container once user logs in
   */
  function dismissThreeIntro() {
    const container = document.getElementById('three-intro-container');
    if (!container) return;

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

  // Export to window
  window.showThreeIntro = showThreeIntro;
  window.dismissThreeIntro = dismissThreeIntro;
  window.startThreeIntro = showThreeIntro;
  window.setIntro3DTheme = setIntro3DTheme;
})();
