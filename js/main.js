"use strict";

/**
 * Vite method for getting text from files
 * Putting the text in GLSL files allows my LSPs to help me with syntax
 */
//import vertexShaderSource from '../shaders/vertexShader.glsl?raw'
//import fragmentShaderSource from '../shaders/fragmentShader.glsl?raw'
var vertexShaderSource;
var fragmentShaderSource;

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

function translate(/** @type {float} */ dx, /** @type {float} */ dy) {
    const translation_loc = gl.getUniformLocation(shaderProgram, "translation");
    const translation_dat = new Float32Array([
        1.0, 0.0, dx,
        0.0, 1.0, dy,
        0.0, 0.0, 1.0
    ]);
    gl.uniformMatrix3fv(translation_loc, false, translation_dat);
}

function rotate(/** @type {float} */ degrees) {
    const transformMat_loc = gl.getUniformLocation(shaderProgram, "transformMat");
    const transformMat_dat = new Float32Array([
        Math.cos(degrees), -Math.sin(degrees), 0.0,
        Math.sin(degrees), Math.cos(degrees), 0.0,
        0.0, 0.0, 1.0,
    ]);
    gl.uniformMatrix3fv(transformMat_loc, false, transformMat_dat);
}

function loadTextures() {
    // magenta PLACEHOLDER
    const texPlaceholder = gl.createTexture();
    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, texPlaceholder);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([255,0,255,255]));
    // end PLACEHOLDER

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // flip vertically

    const meURL = new URL("static/unnamed.jpg", document.baseURI).href;
    const cloverURL = new URL("static/Clover_teeth_removed_cropped.jpg", document.baseURI).href;

    const texMe = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    loadImage(meURL, texMe);

    const texClover = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1); // activate texture unit 0
    loadImage(cloverURL, texClover); // load the image into the texture object
}

function loadImage(/** @type {URL} */ url, /** @type {WebGLTexture} */ textureObject) {
    const image = new Image();
    const texUnit = gl.getParameter(gl.ACTIVE_TEXTURE);

    image.onload = function() {
        gl.activeTexture(texUnit);
        gl.bindTexture(gl.TEXTURE_2D, textureObject);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.generateMipmap(gl.TEXTURE_2D); // only with Po2
            console.log(
                "width: ", image.width,
                " height: ", image.height,
                " texUnit: ", gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0);
        } catch (e) {
            console.log(e);
        }
    };

    image.src = url;
}

function defineBasicTriangle() {
    /*
    colorAttribLoc = gl.getAttribLocation(shaderProgram, 'color');
    gl.enableVertexAttribArray(colorAttribLoc);
    */
    positionAttribLoc = gl.getAttribLocation(shaderProgram, 'position');
    gl.enableVertexAttribArray(positionAttribLoc);

    const redderAttribLoc = gl.getAttribLocation(shaderProgram, 'redder');
    gl.vertexAttrib1f(redderAttribLoc, 0.1);

    trianglePositionVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    // these are in clip coordinates
    const triangleVertices = new Float32Array([
        -1.0, 0.7,
        -0.7, 0.7,
        -0.85, 1.0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
}

var triangleIFSVBO;
var triangleIFSPosVBO;
var totalTriangles = 1000;
/**
 * The same triangle with different vertex color ordering.
 */
function defineTriangleShape() {
    triangleIFSVBO = gl.createBuffer();
    triangleIFSPosVBO = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSVBO);
    const indexedFaceSet = new Uint8Array([0, 1, 2]);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexedFaceSet, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleIFSPosVBO);
    const triangleVertices = new Float32Array([
        -0.7, 0.7,
        -0.4, 0.7,
        -0.55, 1.0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
}

function drawSampleTriangle() {
    const sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");
    gl.uniform1i(sampler_loc, 0);
}

function drawBasicTriangles() {
    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleColorVBO);
    const triangleColors = new Float32Array([
        1.0, 0.0, 0.0, 0.9,
        0.0, 1.0, 0.0, 0.9,
        0.0, 0.0, 1.0, 0.9
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleColors, gl.STATIC_DRAW);
    gl.vertexAttribPointer(colorAttribLoc, 4, gl.FLOAT, false, 0, 0);

    translate(0.0, 0.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleIFSPosVBO);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSVBO);

    for (let i = 0; i < totalTriangles; i++) {
        const dx = Math.random() * 1.4;
        const dy = Math.random() * -1.7;
        translate(dx, dy);
        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_BYTE, 0);
    }
}


/**
 * Some of this needs to be split out into other functions
 */
function drawTexturedTriangles() {
    // set sampler to texture unit 0
    const sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");

    // I need a way to keep track of the current transformation matrix.
    rotate(0);

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);

    // UV attribute
    const tex_coords_loc = gl.getAttribLocation(shaderProgram, "tex_coords");
    gl.enableVertexAttribArray(tex_coords_loc);
    const texVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texVBO);
    gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([0.0, 0.0,  1.0, 0.0,  0.5, 1.0]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(tex_coords_loc, 2, gl.FLOAT, false, 0, 0);

    translate(0.0, 0.0);
    gl.uniform1i(sampler_loc, 0); // 0 = texMe
    gl.drawArrays(gl.TRIANGLES, 0, 3); // top-left triangle

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleIFSPosVBO);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSVBO);

    for (let i = 0; i < totalTriangles; i++) {
        // random texture unit
        const texUnit = Math.floor(Math.random() * 2);
        gl.uniform1i(sampler_loc, texUnit);

        // bounded random location
        const dx = Math.random() * 1.4;
        const dy = Math.random() * -1.7;
        translate(dx, dy);
        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_BYTE, 0); // all triangles
    }
}

function drawPoints() {
}

/** @type {Date} */
var now;

/** @type {boolean} */
var animating;

/** @type {Number} */
var frameTime;

/** @type {Number} */
var lastT, dT;

/** @type {HTMLElement} */
var fpsSlider;

/**
 * Animation handling function
 * 
 */
async function animate() {
    // Change this so the speed increase is linear rather than exponential
    frameTime = fpsSlider.value * -1 + 1000;
    dT = now.getMilliseconds() - lastT;
    lastT = now.getMilliseconds();
    if (dT < frameTime) { // 1 second
        await new Promise(r => setTimeout(r, frameTime - dT));
    }

    if (!animating) { return; }
    //drawTriangles();
    drawTexturedTriangles();
    requestAnimationFrame(animate);
}

function animateButton() {
    animating = !animating;
    if (animating) { animate(); }
}

function handleButtons() {
    document.getElementById("animate-btn").addEventListener("click", animateButton);
}

async function loadShaderText(path) {
    const resource = await fetch(path);
    if (!resource.ok) { throw new Error(resource.statusText); }
    return await resource.text();
}

/**
 * @param {String} vertexSource 
 * @param {String} fragmentSource 
 */
function compileAndLink(vertexSource, fragmentSource) {
    const vertexShader = /** @type {WebGLShader} */ gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader error: ", gl.getShaderInfoLog(vertexShader));
        return;
    }

    const fragmentShader =  /** @type {WebGLShader} */ gl.createShader(gl.FRAGMENT_SHADER);
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
}

function resize() {
    gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function initGL() {
    now = new Date();
    window.addEventListener('resizevertexSource, fragmentSource', resize);
    resize();
    handleButtons();

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    //console.log("Max combined texture image units: ", gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS));

    compileAndLink(vertexShaderSource, fragmentShaderSource);
    gl.useProgram(shaderProgram);

    frameTime = 1000;
    lastT = now.getMilliseconds() - frameTime; // ensure the first iteration doesn't wait
    animating = true;
    fpsSlider = document.getElementById('fps-slider');

    defineBasicTriangle();
    defineTriangleShape();
    loadTextures();

    animate();
}

async function init() {
    try {
        canvas = document.getElementById('webglcanvas');
        const canvas_options = {
            alpha: false,
            depth: false,
            antialias: true
        };
        //gl = canvas.getContext('webgl2', canvas_options)
        //    || canvas.getContext('webgl', canvas_options);
        gl = canvas.getContext('webgl', canvas_options);
        if (!gl) { throw new Error("WebGL is not supported by this browser."); }
    } catch (e) {
        console.error(
            "Error", document.createElement('br'),
            e
        );

        return;
    }

    vertexShaderSource = await loadShaderText("./shaders/vertexShader.glsl");
    fragmentShaderSource = await loadShaderText("./shaders/fragmentShader.glsl");
    initGL();
}

window.onload = init;

