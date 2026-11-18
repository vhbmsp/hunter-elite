import { Vector2 } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SCOPE_POST } from '../config.js';

/**
 * Scoped-only DOF / bloom stack (Phase 5b). Hip-fire uses a direct render so
 * post cost is zero until ADS. DOF defaults off (depth re-render); bloom is mild.
 */
export function createScopePost(renderer, scene, camera) {
  const cfg = SCOPE_POST;
  const size = new Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bokehPass = new BokehPass(scene, camera, {
    focus: cfg.dof.focus,
    aperture: cfg.dof.aperture,
    maxblur: cfg.dof.maxblur,
  });
  bokehPass.enabled = false;
  composer.addPass(bokehPass);

  const bloomPass = new UnrealBloomPass(
    new Vector2(1, 1),
    cfg.bloom.strength,
    cfg.bloom.radius,
    cfg.bloom.threshold,
  );
  bloomPass.enabled = false;
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  applyComposerSize(composer, size.x, size.y, renderer.getPixelRatio(), cfg.resolutionScale);

  let focus = cfg.dof.focus;

  return {
    /** Update bokeh focus distance (metres along the aim ray). */
    setFocus(distance) {
      focus = distance > 0 && Number.isFinite(distance) ? distance : cfg.dof.focus;
      bokehPass.uniforms.focus.value = focus;
    },

    setSize(width, height) {
      applyComposerSize(composer, width, height, renderer.getPixelRatio(), cfg.resolutionScale);
    },

    /**
     * Render one frame. When post is inactive, falls back to a direct draw so
     * soft-GL hip-fire pays nothing for EffectComposer targets.
     */
    render(scoped) {
      const usePost = cfg.enabled && scoped && (cfg.dof.enabled || cfg.bloom.enabled);
      if (!usePost) {
        renderer.render(scene, camera);
        return;
      }

      bokehPass.enabled = !!cfg.dof.enabled;
      bloomPass.enabled = !!cfg.bloom.enabled;
      if (bokehPass.enabled) {
        bokehPass.uniforms.focus.value = focus;
        bokehPass.uniforms.aperture.value = cfg.dof.aperture;
        bokehPass.uniforms.maxblur.value = cfg.dof.maxblur;
        bokehPass.uniforms.nearClip.value = camera.near;
        bokehPass.uniforms.farClip.value = camera.far;
      }
      if (bloomPass.enabled) {
        bloomPass.strength = cfg.bloom.strength;
        bloomPass.radius = cfg.bloom.radius;
        bloomPass.threshold = cfg.bloom.threshold;
      }
      composer.render();
    },

    dispose() {
      bokehPass.dispose();
      bloomPass.dispose();
      outputPass.dispose();
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
    },
  };
}

function applyComposerSize(composer, width, height, pixelRatio, scale) {
  const s = Math.max(0.25, Math.min(1, scale ?? 1));
  // Composer keeps its own pixel-ratio multiplier; scale it down for soft-GL
  // without touching the live canvas DPR used by hip-fire draws.
  composer.setPixelRatio(pixelRatio * s);
  composer.setSize(width, height);
}
