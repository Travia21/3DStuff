"use strict";

// I much prefer working with types, even if they are annotations
var canvas = /** @type {HTMLCanvasElement} */ document.getElementById("webglcanvas");

/** @type {WebGL2RenderingContext} */
var gl;

/** @type {WebGLProgram} */
var shaderProgram;

/** @type {WebGLBuffer} */
var triangleColorVBO, trianglePositionVBO;

/** @type {GLint} */
var colorAttribLoc, positionAttribLoc;

/** @type {Float32Array} */
var translation;

/**
 * Load in the vertex and fragment shader's source
 */
async function loadShaderText(path) {
    const resource = await fetch(path);
    if (!resource.ok) { throw new Error(resource.statusText); }
    return await resource.text();
}

function defineTranslation(/** @type {float} */ dx, /** @type {float} */ dy) {
    translation = new Float32Array([dx, dy]);
    let translationUniformLocation = gl.getUniformLocation(shaderProgram, 'translation');

    gl.uniform2fv(translationUniformLocation, translation);
}

/**
 * Main drawing function
 */
function defineTriangleBuffers() {
    colorAttribLoc = gl.getAttribLocation(shaderProgram, 'color');
    gl.enableVertexAttribArray(colorAttribLoc);
    positionAttribLoc = gl.getAttribLocation(shaderProgram, 'position');
    gl.enableVertexAttribArray(positionAttribLoc);

    let redderAttribLoc = gl.getAttribLocation(shaderProgram, 'redder');
    gl.vertexAttrib1f(redderAttribLoc, 0.1);

    triangleColorVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleColorVBO);
    let triangleColors = new Float32Array([
        1.0, 0.0, 0.0, 0.9,
        0.0, 1.0, 0.0, 0.9,
        0.0, 0.0, 1.0, 0.9
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleColors, gl.STATIC_DRAW);

    trianglePositionVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    // these are in clip coordinates
    let triangleVertices = new Float32Array([
        -1.0, 0.7,
        -0.7, 0.7,
        -0.85, 1.0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
}

var triangleIFSVBO;
var triangleIFSPosVBO;
/**
 * The same triangle with different vertex color ordering.
 */
function defineElementalTriangle() {
    triangleIFSVBO = gl.createBuffer();
    triangleIFSPosVBO = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSVBO);
    let indexedFaceSet = new Uint8Array([1, 2, 0]);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexedFaceSet, gl.STREAM_DRAW);

    let triangleVertices = new Float32Array([
        -0.55, 1.0, // 0 last
        -0.7, 0.7,  // 1 first
        -0.4, 0.7   // 2 middle
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleIFSPosVBO);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
}

function drawTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shaderProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleColorVBO);
    gl.vertexAttribPointer(colorAttribLoc, 4, gl.FLOAT, false, 0, 0);

    defineTranslation(0.0, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleIFSPosVBO);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSVBO);

    for (let i = 0; i < 100; i++) {
        let dx = Math.random() * 1.43;
        let dy = Math.random() * -1.7;
        defineTranslation(dx, dy);
        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_BYTE, 0);
    }
}

/** @type {boolean} */
var animating;

/** @type {Date} */
var now;

/** @type {Number} */
var frameTime, dT, lastT;

/** @type {HTMLElement} */
var fpsSlider;

/**
 * Animation handling function
 * 
 */
async function animate() {
    frameTime = fpsSlider.value * -1 + 1000;
    dT = now.getMilliseconds() - lastT;
    lastT = now.getMilliseconds();
    if (dT < frameTime) { // 1 second
        await new Promise(r => setTimeout(r, frameTime - dT));
    }

    if (!animating) { return; }
    drawTriangles();
    requestAnimationFrame(animate);
}

function animateButton() {
    animating = !animating;
    if (animating) { animate(); }
}

function handleButtons() {
    document.getElementById("animate-btn").addEventListener("click", animateButton);
}

/**
 * @param {String} vertexSource 
 * @param {String} fragmentSource 
 */
function compileAndLink(vertexSource, fragmentSource) {
    let vertexShader = /** @type {WebGLShader} */ gl.createShader(gl.VERTEX_SHADER);

    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader error: ", gl.getShaderInfoLog(vertexShader));
        return;
    }

    let fragmentShader =  /** @type {WebGLShader} */ gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader error: ", gl.getShaderInfoLog(fragmentShader));
        return;
    }

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);

    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Shader program error: ", gl.getProgramInfoLog(shaderProgram));
        return;
    }

    gl.validateProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error("Error validating the shader program: ", gl.getProgramInfoLog(shaderProgram));
        return;
    }

    console.log("Something else");
}

function resize() {
    gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function initGL(vertexShaderSource, fragmentShaderSource) {
    now = new Date();
    window.addEventListener('resize', resize);
    resize();
    handleButtons();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    compileAndLink(vertexShaderSource, fragmentShaderSource);

    lastT = now.getMilliseconds() - frameTime; // ensure the first iteration doesn't wait
    animating = true;
    fpsSlider = document.getElementById('fps-slider');

    defineTriangleBuffers();
    defineElementalTriangle();
    animate();
}

async function init() {
    try {
        canvas = document.getElementById('webglcanvas');
        let canvas_options = {
            alpha: false,
            depth: false,
            antialias: true
        };
        gl = canvas.getContext('webgl2', canvas_options)
            || canvas.getContext('webgl', canvas_options);
        if (!gl) { throw new Error("WebGL is not supported by this browser."); }
    } catch (e) {
        console.error(
            "Error", document.createElement('br'),
            e
        );

        return;
    }

    const vertexShaderSource = await loadShaderText("./shaders/vertexShader.glsl");
    const fragmentShaderSource = await loadShaderText("./shaders/fragmentShader.glsl");
    initGL(vertexShaderSource, fragmentShaderSource);
}

window.onload = init;
