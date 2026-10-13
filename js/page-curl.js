/* Original continuous paper mesh. PDF textures stay local to the browser. */
class PageCurl {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'paper-mesh';
        this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
        this.available = false;
        if (!this.gl) return;
        this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.available = false; });
        const gl = this.gl;
        const vertex = `
            precision highp float;
            attribute vec2 uv;
            uniform vec2 pageSize, canvasSize, margin;
            uniform float progress, corner, forward, singlePage, shadow;
            varying vec2 textureUV, paperXY;
            varying float angle, elevation;
            const float PI = 3.14159265359;
            void main() {
                textureUV = uv;
                // The selected corner leads the opposite corner. Integrating
                // each row's tangent gives a continuous arc, fixed at the spine.
                float bend = sin(PI * progress);
                float local = clamp(progress + .24 * bend * corner * (2.0 * uv.y - 1.0), 0.0, 1.0);
                float curvature = -1.8 * sin(PI * local);
                float start = PI * local - curvature * .5;
                angle = start + curvature * uv.x;
                float x, z;
                if (abs(curvature) < .001) {
                    x = uv.x * cos(start); z = uv.x * sin(start);
                } else {
                    x = (sin(angle) - sin(start)) / curvature;
                    z = (cos(start) - cos(angle)) / curvature;
                }
                x *= pageSize.x; z *= pageSize.x;
                float direction = forward > .5 ? 1.0 : -1.0;
                float hinge = singlePage > .5 ? 0.0 : pageSize.x;
                float y = uv.y * pageSize.y - corner * .10 * pageSize.x * bend * uv.x * uv.x;
                x = hinge + direction * x;
                elevation = z / pageSize.x;
                if (shadow > .5) {
                    x += direction * z * .12; y += z * .035; z = -1.0;
                }
                float eyeX = singlePage > .5 ? pageSize.x * .5 : pageSize.x;
                float distance = pageSize.x * 10.0;
                float scale = shadow > .5 ? 1.0 : distance / (distance - z);
                paperXY = vec2(eyeX + (x-eyeX)*scale, pageSize.y*.5+(y-pageSize.y*.5)*scale);
                vec2 screen = (paperXY + margin) / canvasSize;
                gl_Position = vec4(screen.x*2.0-1.0, 1.0-screen.y*2.0, -z/(pageSize.x*2.0), 1.0);
            }`;
        const fragment = `
            precision highp float;
            uniform sampler2D frontTexture, backTexture;
            uniform float forward, progress, shadow, singlePage;
            uniform vec2 pageSize;
            varying vec2 textureUV, paperXY;
            varying float angle, elevation;
            void main() {
                float bend = sin(3.14159265359 * progress);
                if (shadow > .5) {
                    float bookWidth = pageSize.x * (singlePage > .5 ? 1.0 : 2.0);
                    if (paperXY.x < 0.0 || paperXY.x > bookWidth || paperXY.y < 0.0 || paperXY.y > pageSize.y) discard;
                    float edge = smoothstep(0.0,.045,textureUV.x) * (1.0-smoothstep(.94,1.0,textureUV.x));
                    edge *= smoothstep(0.0,.025,textureUV.y)*(1.0-smoothstep(.975,1.0,textureUV.y));
                    gl_FragColor = vec4(.10,.08,.06, bend * edge * (.24-.11*elevation));
                } else {
                    bool front = gl_FrontFacing == (forward > .5);
                    vec2 sampleUV = textureUV;
                    if (front != (forward > .5)) sampleUV.x = 1.0 - sampleUV.x;
                    vec4 color = front ? texture2D(frontTexture,sampleUV) : texture2D(backTexture,sampleUV);
                    // Interpolated lighting avoids per-strip brightness bands.
                    float shade = 1.0 - .18*abs(sin(angle)) - .035*bend;
                    float rim = .035 * pow(max(0.0,cos(angle-1.1)),12.0)*bend;
                    vec3 paper = front ? vec3(1.0) : vec3(1.0,.995,.98);
                    gl_FragColor = vec4(clamp(color.rgb*paper*shade+rim,0.0,1.0),1.0);
                }
            }`;
        try {
            const compile = (type, source) => {
                const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Paper shader unavailable'); }
                return shader;
            };
            const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
            this.program = gl.createProgram(); gl.attachShader(this.program, vs); gl.attachShader(this.program, fs); gl.linkProgram(this.program);
            gl.deleteShader(vs); gl.deleteShader(fs);
            if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Paper mesh unavailable');
            gl.useProgram(this.program);
            const vertices = [], columns = 48, rows = 24;
            for (let y=0;y<rows;y++) for (let x=0;x<columns;x++) {
                const l=x/columns,r=(x+1)/columns,t=y/rows,b=(y+1)/rows;
                vertices.push(l,t,r,t,l,b,r,t,r,b,l,b);
            }
            this.vertices = vertices.length / 2;
            this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
            const uv = gl.getAttribLocation(this.program,'uv'); gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);
            this.uniforms = Object.fromEntries(['pageSize','canvasSize','margin','progress','corner','forward','singlePage','shadow','frontTexture','backTexture'].map(name=>[name,gl.getUniformLocation(this.program,name)]));
            this.textures = [gl.createTexture(),gl.createTexture()];
            gl.uniform1i(this.uniforms.frontTexture,0); gl.uniform1i(this.uniforms.backTexture,1);
            gl.frontFace(gl.CW); gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
            gl.clearColor(0,0,0,0); this.available = true;
        } catch { this.destroy(); }
    }

    setPages(front, back, { width, height, singlePage, scale }) {
        if (!this.available) return false;
        const gl = this.gl;
        const margin = { x: width*.36, y: width*.18 };
        const canvasWidth = width*(singlePage?1:2)+2*margin.x, canvasHeight = height+2*margin.y;
        const budget = window.matchMedia('(pointer: coarse)').matches ? 3000000 : 6000000;
        const ratio = Math.min(scale*Math.min(window.devicePixelRatio||1,2),Math.sqrt(budget/(canvasWidth*canvasHeight)));
        this.canvas.width = Math.max(1,Math.ceil(canvasWidth*ratio)); this.canvas.height = Math.max(1,Math.ceil(canvasHeight*ratio));
        Object.assign(this.canvas.style,{width:`${canvasWidth}px`,height:`${canvasHeight}px`,left:`${-margin.x}px`,top:`${-margin.y}px`});
        gl.viewport(0,0,this.canvas.width,this.canvas.height);
        gl.uniform2f(this.uniforms.pageSize,width,height); gl.uniform2f(this.uniforms.canvasSize,canvasWidth,canvasHeight); gl.uniform2f(this.uniforms.margin,margin.x,margin.y); gl.uniform1f(this.uniforms.singlePage,singlePage?1:0);
        try {
            [front,back].forEach((data,i)=>{
                gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
                if(data) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,data.canvas);
                else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,254,250,255]));
            });
            return gl.getError() === gl.NO_ERROR;
        } catch { return false; }
    }

    draw(progress, corner, forward) {
        if (!this.available) return false;
        const gl = this.gl;
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(this.uniforms.progress,progress); gl.uniform1f(this.uniforms.corner,corner); gl.uniform1f(this.uniforms.forward,forward?1:0);
        gl.uniform1f(this.uniforms.shadow,1); gl.drawArrays(gl.TRIANGLES,0,this.vertices);
        gl.uniform1f(this.uniforms.shadow,0); gl.drawArrays(gl.TRIANGLES,0,this.vertices);
        return true;
    }

    destroy() {
        const gl = this.gl;
        this.textures?.forEach(texture=>gl.deleteTexture(texture));
        if(this.buffer) gl.deleteBuffer(this.buffer);
        if(this.program) gl.deleteProgram(this.program);
        this.available = false;
    }
}
window.PageCurl = PageCurl;
