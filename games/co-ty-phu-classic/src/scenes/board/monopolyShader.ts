/** Analytic, antialiased perimeter lighting with coherent flowing fire at a complete set.
 * Each small quad runs on the GPU; there are no repainted canvases or per-frame particle lists.
 */
export const MONOPOLY_FRAGMENT = `
#pragma phaserTemplate(shaderName)
#pragma phaserTemplate(extensions)
#pragma phaserTemplate(features)
precision highp float;
#pragma phaserTemplate(fragmentDefine)
varying vec2 outTexCoord;
#pragma phaserTemplate(outVariables)
uniform vec2 uSize;
uniform vec2 uA;
uniform vec2 uB;
uniform vec2 uC;
uniform vec2 uD;
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
uniform float uPhase;
#pragma phaserTemplate(fragmentHeader)

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
vec2 segment(vec2 p, vec2 a, vec2 b, float offset) {
  vec2 edge = b - a;
  float t = clamp(dot(p - a, edge) / dot(edge, edge), 0., 1.);
  return vec2(length(p - a - t * edge), offset + t * length(edge));
}
float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
void main() {
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uSize;
  vec2 nearest = segment(p, uA, uB, 0.);
  float offset = length(uB - uA);
  vec2 edge = segment(p, uB, uC, offset);
  if (edge.x < nearest.x) nearest = edge;
  offset += length(uC - uB);
  edge = segment(p, uC, uD, offset);
  if (edge.x < nearest.x) nearest = edge;
  offset += length(uD - uC);
  edge = segment(p, uD, uA, offset);
  if (edge.x < nearest.x) nearest = edge;
  float d = nearest.x;
  bool inside = cross2(uB-uA,p-uA) >= 0. && cross2(uC-uB,p-uB) >= 0.
             && cross2(uD-uC,p-uC) >= 0. && cross2(uA-uD,p-uD) >= 0.;
  float signedDistance = inside ? -d : d;
  float alpha = 1. - smoothstep(.45, 1.25, d);
  vec3 color = uColor;
  float hot = 0.;
  if (uStrength >= 2.) {
    float pulse = .92 + .08 * sin(uTime * 1.7 + uPhase);
    float width = uStrength >= 3. ? 6.0 : 3.7;
    float glow = exp(-d * d / (width * width)) * (uStrength >= 3. ? .38 : .16) * pulse;
    alpha = max(alpha, glow);
    color = mix(uColor, vec3(1.), .07);
    if (uStrength >= 3.) {
      float flow = noise(vec2(nearest.y * .060 - uTime * .8, signedDistance * .17 - uTime * 1.3));
      float detail = noise(vec2(nearest.y * .13 + uTime * .6, signedDistance * .25 - uTime * 2.1));
      float reach = 4. + flow * 8.;
      float flame = (1. - smoothstep(0., reach, max(0., signedDistance)))
                  * smoothstep(-.5, 1., signedDistance) * smoothstep(.25, .72, flow * .75 + detail * .25);
      alpha = max(alpha, flame * .95);
      hot = exp(-d * d * 1.4) * (.55 + flow * .20);
      color = mix(uColor * 1.35, vec3(1., .96, .85), hot);
    }
  }
  vec4 fragColor = vec4(color * alpha, alpha);
  #pragma phaserTemplate(fragmentProcess)
  gl_FragColor = fragColor;
}
`;
