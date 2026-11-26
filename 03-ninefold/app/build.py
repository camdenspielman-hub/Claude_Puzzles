"""Inline src/*.css and src/*.js into a single dist/ninefold.html (artifact body format)."""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
ORDER = ["data.js", "rules.js", "grid.js", "constraints.js", "audio.js", "world.js", "fog.js", "transitions.js", "island.js", "main.js", "boot.js"]
html = open(os.path.join(SRC, "index.html")).read()
css = open(os.path.join(SRC, "style.css")).read()
js = "\n".join(open(os.path.join(SRC, f)).read() for f in ORDER if os.path.exists(os.path.join(SRC, f)))
html = html.replace("/*@@CSS@@*/", css).replace("/*@@JS@@*/", js)
vendor = ['<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js"></script>',
          '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js"></script>',
          '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js"></script>',
          '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js"></script>',
          '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js"></script>',
          '<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js"></script>']
# post-processing scripts are no longer used
os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
out = os.path.join(HERE, "dist", "ninefold.html")
open(out, "w").write(html)
print("wrote", out, len(html))
