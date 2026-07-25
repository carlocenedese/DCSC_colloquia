// Animated WebGL gradient for the hero background, via @shadergradient/react.
// Loaded from esm.sh (no bundler in this project) — genuinely fragile: no lockfile,
// depends on a third-party CDN staying up. Fails silently and leaves the flat
// --tud-blue fallback background (set in CSS) if anything here breaks.
// Also skipped entirely for prefers-reduced-motion, since this is a moving shader.
(async function () {
  const root = document.getElementById("hero-shader-root");
  if (!root) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  try {
    const React = await import("https://esm.sh/react@18.3.1");
    const ReactDOMClient = await import("https://esm.sh/react-dom@18.3.1/client");
    const { ShaderGradientCanvas, ShaderGradient } = await import(
      "https://esm.sh/@shadergradient/react@2.4.20?deps=react@18.3.1,react-dom@18.3.1,three@0.160.0,@react-three/fiber@8.15.0,three-stdlib@2.29.0,camera-controls@2.9.0"
    );

    const el = React.createElement(
      ShaderGradientCanvas,
      { style: { position: "absolute", inset: 0, width: "100%", height: "100%" } },
      React.createElement(ShaderGradient, {
        animate: "on",
        brightness: 1.2,
        cAzimuthAngle: 180,
        cDistance: 3.6,
        cPolarAngle: 90,
        cameraZoom: 1,
        color1: "#305dff",
        color2: "#0dcddb",
        color3: "#d0bce1",
        envPreset: "city",
        fov: 45,
        grain: "on",
        lightType: "3d",
        positionX: -1.4,
        positionY: 0,
        positionZ: 0,
        reflection: 0.1,
        rotationX: 0,
        rotationY: 10,
        rotationZ: 50,
        shader: "defaults",
        type: "waterPlane",
        uAmplitude: 1,
        uDensity: 1.3,
        uFrequency: 5.5,
        uSpeed: 0.4,
        uStrength: 4,
        wireframe: false,
      })
    );

    ReactDOMClient.createRoot(root).render(el);
  } catch (err) {
    console.warn("Hero shader failed to load, keeping flat fallback background:", err);
  }
})();
