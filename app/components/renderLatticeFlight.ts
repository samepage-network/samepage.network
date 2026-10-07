type Node3D = { u: number; v: number; layer: number; j: number; s: number };
type Point3D = {
  x: number;
  y: number;
  d: number;
  fade?: number;
  spark?: number;
};
type Projected = {
  sx: number;
  sy: number;
  mask: number;
  scale: number;
  d: number;
  fade: number;
  spark: number;
};
type ScreenPoint = { sx: number; sy: number };
type Color = [number, number, number];

// Geometry and timing from the selected Lattice Flight prototype.
const startLatticeFlight = (
  webglCanvas: HTMLCanvasElement,
  fallbackCanvas: HTMLCanvasElement
): (() => void) => {
  const TAU = Math.PI * 2;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let W = 1,
    H = 1,
    DPR = 1,
    time = 0,
    frame = 0,
    last = 0,
    disposed = false;
  let gl: WebGLRenderingContext | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  const shaders: WebGLShader[] = [];
  let canvas = webglCanvas;
  const enableFallback = () => {
    webglCanvas.hidden = true;
    fallbackCanvas.hidden = false;
    canvas = fallbackCanvas;
    ctx = fallbackCanvas.getContext("2d");
    gl = null;
  };
  const releaseWebGL = () => {
    if (!gl) return;
    shaders.forEach((shader) => gl?.deleteShader(shader));
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
  };
  try {
    gl = webglCanvas.getContext("webgl", { alpha: false, antialias: true });
    if (!gl) throw new Error("WebGL is unavailable");
    const context = gl;
    const make = (type: number, source: string) => {
      const shader = context.createShader(type);
      if (!shader) throw new Error("Unable to create shader");
      shaders.push(shader);
      context.shaderSource(shader, source);
      context.compileShader(shader);
      if (!context.getShaderParameter(shader, context.COMPILE_STATUS))
        throw new Error("Unable to compile shader");
      return shader;
    };
    program = gl.createProgram();
    if (!program) throw new Error("Unable to create program");
    gl.attachShader(
      program,
      make(
        gl.VERTEX_SHADER,
        "attribute vec2 pos;attribute float alpha;attribute float size;attribute vec3 color;varying float a;varying vec3 c;void main(){gl_Position=vec4(pos,0.,1.);gl_PointSize=size;a=alpha;c=color;}"
      )
    );
    gl.attachShader(
      program,
      make(
        gl.FRAGMENT_SHADER,
        "precision mediump float;varying float a;varying vec3 c;uniform float point;void main(){float k=1.;if(point>0.5){float r=length(gl_PointCoord-.5)*2.;k=exp(-r*r*5.)*smoothstep(1.,.75,r);}gl_FragColor=vec4(c,a*k);}"
      )
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Unable to link program");
    gl.useProgram(program);
    buffer = gl.createBuffer();
    if (!buffer) throw new Error("Unable to create buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const attributes: [string, number, number][] = [
      ["pos", 2, 0],
      ["alpha", 1, 8],
      ["size", 1, 12],
      ["color", 3, 16],
    ];
    for (const [name, size, offset] of attributes) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 28, offset);
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0.002, 0.005, 0.022, 1);
  } catch {
    releaseWebGL();
    enableFallback();
  }
  const nodes: Node3D[] = [],
    edges: [number, number][] = [];
  const stars: { a: number; r: number; d: number; s: number }[] = [];
  let seed = 192872;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const mod = (n: number, m: number) => ((n % m) + m) % m;
  const grid = (n: number, m: number, layer: number) => {
    const offset = nodes.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++)
        nodes.push({
          u: i / n,
          v: j / (m - 1),
          layer,
          j: rand() - 0.5,
          s: rand(),
        });
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        const a = offset + i * m + j;
        if (i < n - 1) edges.push([a, a + m]);
        if (j < m - 1) edges.push([a, a + 1]);
        if (i < n - 1 && j < m - 1 && rand() > 0.3) edges.push([a, a + m + 1]);
      }
  };
  grid(66, 25, -1);
  grid(66, 25, 1);
  for (let i = 0; i < 400; i++)
    stars.push({ a: rand() * TAU, r: 2 + rand() * 24, d: rand(), s: rand() });
  const geometry = (p: Node3D, t: number, seconds: number): Point3D => {
    const d = 2 + mod(p.u * 48 - seconds * 3, 48);
    let x = (p.v - 0.5) * 40;
    let y =
      p.layer *
      (3.6 +
        1.8 * Math.sin(x * 0.23 + d * 0.12 + t) +
        0.65 * Math.sin(d * 0.5 + t * 2 + x * 0.4));
    y += x * 0.1 * Math.sin(t);
    x += 1.3 * Math.sin(d * 0.1 + t);
    x += p.j * 0.16;
    y += p.j * 0.13;
    const fade = Math.min(1, (d - 2) / 3, (50 - d) / 10);
    const roll = 0.09 * Math.sin(t);
    const xx = x * Math.cos(roll) - y * Math.sin(roll);
    y = x * Math.sin(roll) + y * Math.cos(roll);
    x = xx;
    return { x, y, d, fade: Math.max(0, fade), spark: p.s };
  };
  const blue: Color = [93 / 255, 166 / 255, 237 / 255],
    navy: Color = [0.02, 0.04, 0.267],
    ice: Color = [0.65, 0.82, 0.97];
  const projection = (p: Point3D): Projected => {
    const f = Math.max(W * 0.86, H * 0.9),
      x = (p.x * f) / p.d,
      y = (p.y * f) / p.d;
    const central = Math.sqrt((x / (W * 0.26)) ** 2 + (y / (H * 0.19)) ** 2);
    const mask = Math.min(1, Math.max(0.07, (central - 0.5) * 1.8));
    return {
      sx: x,
      sy: y,
      mask,
      scale: f / p.d,
      d: p.d,
      fade: p.fade ?? 1,
      spark: p.spark ?? 0,
    };
  };
  const vertex = (
    data: number[],
    p: ScreenPoint,
    alpha: number,
    size: number,
    color: Color
  ) => {
    data.push((p.sx / W) * 2, (-p.sy / H) * 2, alpha, size * DPR, ...color);
  };
  const draw = (data: number[], point: boolean) => {
    if (!data.length) return;
    if (gl && program) {
      gl.uniform1f(gl.getUniformLocation(program, "point"), point ? 1 : 0);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
      gl.drawArrays(point ? gl.POINTS : gl.LINES, 0, data.length / 7);
    } else if (ctx) {
      for (let i = 0; i < data.length; i += point ? 7 : 14) {
        const x = (data[i] * W) / 2,
          y = (-data[i + 1] * H) / 2,
          a = data[i + 2],
          s = data[i + 3] / DPR;
        const c = data.slice(i + 4, i + 7).map((v) => Math.round(v * 255));
        if (point) {
          const r = Math.max(0.4, s / 2),
            g = ctx.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(${c},${a})`);
          g.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        } else {
          ctx.strokeStyle = `rgba(${c},${a})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo((data[i + 7] * W) / 2, (-data[i + 8] * H) / 2);
          ctx.stroke();
        }
      }
    }
  };
  const render = (seconds: number) => {
    time = seconds;
    const t = (seconds / 16) * TAU;
    if (gl) gl.clear(gl.COLOR_BUFFER_BIT);
    else if (ctx) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#010106";
      ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2);
      ctx.globalCompositeOperation = "lighter";
    }
    const lines: number[] = [],
      points: number[] = [],
      glows: number[] = [],
      starLines: number[] = [],
      starPoints: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      const p = projection({
        x: Math.cos(a + t) * 8,
        y: Math.sin(a + t) * 5,
        d: 18,
      });
      vertex(glows, p, 0.18, Math.min(W, H) * 1.15, i % 2 ? blue : navy);
    }
    draw(glows, true);
    for (const s of stars) {
      const d = 2 + mod(s.d * 64 - seconds * 4, 64),
        a = s.a;
      const p = projection({ x: Math.cos(a) * s.r, y: Math.sin(a) * s.r, d });
      const q = projection({
        x: Math.cos(a) * s.r,
        y: Math.sin(a) * s.r,
        d: d + 0.6 + s.s * 0.65,
      });
      const alpha =
        Math.min(1, (d - 2) / 2, (66 - d) / 10) * (0.12 + s.s * 0.5) * p.mask;
      vertex(
        starPoints,
        p,
        alpha,
        (0.8 + s.s * 1.6) * Math.min(2, 14 / d),
        s.s > 0.94 ? ice : blue
      );
      vertex(starLines, p, alpha * 0.6, 1, blue);
      vertex(starLines, q, 0.02, 1, blue);
    }
    draw(starLines, false);
    draw(starPoints, true);
    const projected = nodes.map((p) => projection(geometry(p, t, seconds)));
    for (const [a, b] of edges) {
      const p = projected[a],
        q = projected[b];
      if (Math.abs(p.d - q.d) > 7 || p.d < 2.05 || q.d < 2.05) continue;
      const depth = 1 - p.d / 65,
        pulse = 0.5 + 0.5 * Math.sin(p.d * 0.8 - t * 3 + nodes[a].layer);
      const alpha =
        (0.11 + depth * 0.12 + pulse * 0.18) *
        Math.min(p.fade, q.fade) *
        Math.min(p.mask, q.mask);
      vertex(lines, p, alpha, 1, blue);
      vertex(lines, q, alpha, 1, blue);
    }
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      if (p.d < 2.05) continue;
      const pulse = 0.5 + 0.5 * Math.sin(p.d * 0.8 - t * 3 + nodes[i].layer);
      const alpha = (0.22 + p.spark * 0.43 + pulse * 0.3) * p.fade * p.mask;
      const size = (0.027 + p.spark * 0.038) * p.scale;
      vertex(
        points,
        p,
        alpha,
        Math.max(1.7, size * 2.8),
        p.spark > 0.91 ? ice : blue
      );
      if (p.spark > 0.985) {
        vertex(points, p, alpha * 0.6, Math.min(90, size * 18), blue);
        vertex(points, p, alpha, Math.max(3, size * 3), ice);
      }
    }
    draw(lines, false);
    draw(points, true);
    const signals: number[] = [];
    for (let k = 0; k < 42; k++) {
      const [a, b] = edges[(k * 71) % edges.length],
        p = projected[a],
        q = projected[b],
        f = mod(seconds * 0.25 + k * 0.173, 1);
      if (Math.abs(p.d - q.d) > 7) continue;
      const point = {
        sx: p.sx * (1 - f) + q.sx * f,
        sy: p.sy * (1 - f) + q.sy * f,
      };
      const alpha =
        Math.sin(f * Math.PI) *
        Math.min(p.fade, q.fade) *
        Math.min(p.mask, q.mask) *
        0.8;
      vertex(signals, point, alpha, 16, blue);
      vertex(signals, point, alpha, 4, ice);
    }
    draw(signals, true);
  };
  const resize = () => {
    W = innerWidth;
    H = innerHeight;
    DPR = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    render(time);
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || reduced.matches || document.hidden) return;
    const dt = (now - last) / 1000;
    last = now;
    render(time + Math.min(dt, 0.07));
    frame = requestAnimationFrame(tick);
  };
  const syncMotion = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (disposed) return;
    if (!reduced.matches && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    enableFallback();
    resize();
    syncMotion();
  };
  webglCanvas.addEventListener("webglcontextlost", onContextLost);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", syncMotion);
  reduced.addEventListener("change", syncMotion);
  resize();
  syncMotion();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", syncMotion);
    reduced.removeEventListener("change", syncMotion);
    webglCanvas.removeEventListener("webglcontextlost", onContextLost);
    releaseWebGL();
  };
};

export default startLatticeFlight;
