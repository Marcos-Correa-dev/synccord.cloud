/**
 * SyncCord Three.js + GSAP 3D Purple Experience
 * Inspired by https://threejs-challenge-0.netlify.app/
 * Features:
 * - Floating morphing crystal spheres with specular purple highlights & fresnel
 * - Orbiting satellite glass orbs with organic wave motion
 * - Undulating 3D wave grid / neon purple terrain
 * - Floating particle nebula / starfield
 * - Interactive mouse parallax camera tracking
 * - GSAP cinematic timeline: 3D scene reveals -> modal gracefully appears
 */

(function () {
  'use strict';

  let scene, camera, renderer;
  let mainSphere, satelliteOrbs = [], waveGrid, particles;
  let animationFrameId = null;
  let isRunning = false;
  let mouseX = 0, mouseY = 0;
  let targetCameraX = 0, targetCameraY = 0;
  let clock;
  let gridOriginalPositions = null;
  let sphereOriginalPositions = null;

  function isWebGLAvailable() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
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

      // 1. SCENE & FOG
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x090314);
      scene.fog = new THREE.FogExp2(0x090314, 0.035);

      // 2. CAMERA
      camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
      camera.position.set(0, 0.4, 7);

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
        renderer.toneMappingExposure = 1.25;
      }

      clock = new THREE.Clock();

      // 4. LIGHTS (Deep cyber purple, electric violet, magenta rim)
      const ambientLight = new THREE.AmbientLight(0x2e1065, 1.8);
      scene.add(ambientLight);

      // Main purple key light
      const pointLight1 = new THREE.PointLight(0xc084fc, 4.5, 35);
      pointLight1.position.set(4, 5, 5);
      scene.add(pointLight1);

      // Deep neon violet fill light
      const pointLight2 = new THREE.PointLight(0x9333ea, 3.5, 30);
      pointLight2.position.set(-5, -2, 4);
      scene.add(pointLight2);

      // Fuchsia/magenta accent rim light
      const pointLight3 = new THREE.PointLight(0xf472b6, 3.0, 25);
      pointLight3.position.set(0, 4, -4);
      scene.add(pointLight3);

      // Cyan-violet directional backlight
      const dirLight = new THREE.DirectionalLight(0x818cf8, 2.0);
      dirLight.position.set(0, 8, 3);
      scene.add(dirLight);

      // 5. CENTRAL FLOATING MORPHING SPHERE (Liquid Crystal Orb)
      const sphereGeo = new THREE.SphereGeometry(1.45, 64, 64);
      sphereOriginalPositions = sphereGeo.attributes.position.clone();

      const sphereMat = new THREE.MeshPhysicalMaterial({
        color: 0x581c87,
        emissive: 0x240046,
        emissiveIntensity: 0.6,
        roughness: 0.12,
        metalness: 0.88,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
      });

      mainSphere = new THREE.Mesh(sphereGeo, sphereMat);
      mainSphere.position.set(0, 0.2, 0);
      scene.add(mainSphere);

      // Glowing Neon Rings around Main Sphere
      const ringGeo = new THREE.TorusGeometry(1.85, 0.02, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.45,
      });
      const ring1 = new THREE.Mesh(ringGeo, ringMat);
      ring1.rotation.x = Math.PI / 3;
      mainSphere.add(ring1);

      const ring2 = new THREE.Mesh(ringGeo, ringMat.clone());
      ring2.rotation.x = -Math.PI / 3;
      ring2.rotation.y = Math.PI / 4;
      ring2.scale.set(1.15, 1.15, 1.15);
      mainSphere.add(ring2);

      // 6. ORBITING SATELLITE CRYSTAL ORBS (Refractive / Glossy, like reference)
      const orbColors = [0xa855f7, 0xc084fc, 0x7c3aed, 0xe879f9, 0x9333ea];
      satelliteOrbs = [];

      for (let i = 0; i < 5; i++) {
        const radius = 0.3 + (i % 3) * 0.12;
        const orbGeo = new THREE.SphereGeometry(radius, 32, 32);
        const orbMat = new THREE.MeshPhysicalMaterial({
          color: orbColors[i % orbColors.length],
          emissive: 0x3b0764,
          emissiveIntensity: 0.5,
          roughness: 0.15,
          metalness: 0.75,
          clearcoat: 1.0,
          clearcoatRoughness: 0.15,
        });

        const orbMesh = new THREE.Mesh(orbGeo, orbMat);
        const angle = (i / 5) * Math.PI * 2;
        const dist = 2.6 + (i % 2) * 0.9;
        orbMesh.userData = {
          baseAngle: angle,
          orbitDistance: dist,
          orbitSpeed: 0.45 + (i * 0.1),
          verticalFreq: 1.2 + (i * 0.3),
          verticalAmp: 0.45 + (i * 0.1),
          yOffset: -0.3 + (i * 0.25),
        };

        scene.add(orbMesh);
        satelliteOrbs.push(orbMesh);
      }

      // 7. UNDULATING 3D NEON PURPLE WAVE TERRAIN (Grid / Ribbons)
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

      // 8. PURPLE FLOATING STARFIELD PARTICLES
      const particleCount = 650;
      const particlePositions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 24;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 16;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }

      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

      // Particle sprite using canvas texture
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 32;
      pCanvas.height = 32;
      const pCtx = pCanvas.getContext('2d');
      const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(216, 180, 254, 1)');
      grad.addColorStop(0.3, 'rgba(168, 85, 247, 0.8)');
      grad.addColorStop(0.8, 'rgba(124, 58, 237, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      pCtx.fillStyle = grad;
      pCtx.fillRect(0, 0, 32, 32);

      const pTex = new THREE.CanvasTexture(pCanvas);
      const particleMat = new THREE.PointsMaterial({
        size: 0.22,
        map: pTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: 0xd8b4fe,
      });

      particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // 9. EVENT LISTENERS
      window.addEventListener('resize', onWindowResize, false);
      window.addEventListener('mousemove', onMouseMove, false);
      window.addEventListener('touchmove', onTouchMove, { passive: true });

      // Quick click on background brings up modal immediately
      container.addEventListener('click', (e) => {
        if (e.target === container || e.target === canvas || e.target.closest('#three-intro-hero')) {
          revealModalInstantly();
        }
      });

      return true;
    } catch (err) {
      console.warn('[ThreeIntro] Error initializing Three scene:', err);
      return false;
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
    targetCameraX = mouseX * 1.2;
    targetCameraY = mouseY * 0.8;
    camera.position.x += (targetCameraX - camera.position.x) * 0.04;
    camera.position.y += (0.4 + targetCameraY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    // 2. Morph Main Sphere Vertices (Liquid crystal effect)
    if (mainSphere && sphereOriginalPositions) {
      mainSphere.rotation.y = time * 0.2;
      mainSphere.rotation.x = Math.sin(time * 0.3) * 0.15;
      mainSphere.position.y = 0.2 + Math.sin(time * 1.2) * 0.12;

      const pos = mainSphere.geometry.attributes.position;
      const orig = sphereOriginalPositions;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        const ox = orig.getX(i);
        const oy = orig.getY(i);
        const oz = orig.getZ(i);

        // Organic harmonic ripple
        const wave = Math.sin(ox * 2.5 + time * 2.2) *
                     Math.cos(oy * 2.5 + time * 1.8) *
                     Math.sin(oz * 2.0 + time * 1.4) * 0.08;

        pos.setXYZ(i, ox * (1 + wave), oy * (1 + wave), oz * (1 + wave));
      }
      pos.needsUpdate = true;
      mainSphere.geometry.computeVertexNormals();
    }

    // 3. Orbit Satellite Orbs
    satelliteOrbs.forEach((orb) => {
      const d = orb.userData;
      const currentAngle = d.baseAngle + time * d.orbitSpeed;
      orb.position.x = Math.cos(currentAngle) * d.orbitDistance;
      orb.position.z = Math.sin(currentAngle) * d.orbitDistance;
      orb.position.y = d.yOffset + Math.sin(time * d.verticalFreq) * d.verticalAmp;

      orb.rotation.x += 0.01;
      orb.rotation.y += 0.015;
    });

    // 4. Undulate 3D Wave Terrain Grid
    if (waveGrid && gridOriginalPositions) {
      const pos = waveGrid.geometry.attributes.position;
      const orig = gridOriginalPositions;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        const ox = orig.getX(i);
        const oy = orig.getY(i);

        const zWave = Math.sin(ox * 0.35 + time * 1.6) * Math.cos(oy * 0.35 + time * 1.4) * 0.55 +
                      Math.sin((ox + oy) * 0.2 + time * 2.0) * 0.25;

        pos.setZ(i, orig.getZ(i) + zWave);
      }
      pos.needsUpdate = true;
    }

    // 5. Rotate Particles
    if (particles) {
      particles.rotation.y = time * 0.03;
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
   * Shows the 3D Purple Intro Experience with GSAP:
   * 1. 3D Purple Canvas & Hero reveal
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
          opacity: 0.7,
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
})();
