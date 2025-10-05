"use strict";

//const { Vector3 } = require("three");

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
var aspect;

/** @type {WebGL2RenderingContext} */
var gl;

/** @type {WebGLProgram} */
var shaderProgram;

/** @type {GLint} */
var u_transformMatrix_loc;

/** @type {mat4} */
var u_transformMatrix_dat;
var transformMatrixStack;

/** @type {mat4} */
var u_modelview_loc, u_projection_loc;
var u_modelview_dat, u_projection_dat;

/** @type {SimpleRotator} */
var rotator;

/** @type {WebGLBuffer} */
var triangleColorVBO, trianglePositionVBO;

/** @type {GLint} */
var a_color_loc, a_position_loc;
var a_color_dat, a_position_dat;
var u_textured_loc, u_sampler_loc;
var u_texCoords_loc;

function translate2D(/** @type {float} */ dx, /** @type {float} */ dy) {
    mat4.translate(u_transformMatrix_dat, u_transformMatrix_dat, [dx, dy, 0.0, 0.0]);
}

function rotate2D(/** @type {float} */ radians) {
    mat4.rotate(u_transformMatrix_dat, u_transformMatrix_dat, radians, [0, 1, 0]);
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

    // UV attribute
    u_texCoords_loc = gl.getAttribLocation(shaderProgram, "tex_coords");
    const texVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texVBO);
    gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([0.0, 0.0,  1.0, 0.0,  0.5, 1.0]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(u_texCoords_loc, 2, gl.FLOAT, false, 0, 0);
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
        } catch (e) {
            console.log(e);
        }
    };

    image.src = url;
}

function defineBasicTriangle() {
    trianglePositionVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    // these are in clip coordinates
    const triangleVertices = new Float32Array([
        -0.15, -0.10, +0.3,
        +0.15, -0.10, +0.3,
        +0.00, +0.20, +0.3
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
        -0.15, -0.15, +0.3,
        +0.15, -0.15, +0.3,
        +0.00, +0.15, +0.3
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
}

/**
 * Set up to draw a series of gl.TRIANGLE_FAN
 */
function drawBasicObject(primitiveType, color, vertices) {
    //gl.enableVertexAttribArray(a_color_loc);
    gl.enableVertexAttribArray(a_position_loc);

    const vertexCount = vertices.length/3;
    const colorParts = color.length;

    gl.vertexAttrib4fv(a_color_loc, color);

    //let vertexColors = new Float32Array(vertexCount * colorParts);
    //for (let i = 0; i < vertexCount; i++) {
    //    vertexColors[i * colorParts + 0] = color[0];
    //    vertexColors[i * colorParts + 1] = color[1];
    //    vertexColors[i * colorParts + 2] = color[2];
    //    vertexColors[i * colorParts + 3] = color[3];
    //}

    //gl.bindBuffer(gl.ARRAY_BUFFER, a_color_dat);
    //gl.bufferData(gl.ARRAY_BUFFER, vertexColors, gl.STATIC_DRAW);
    //gl.vertexAttribPointer(a_color_loc, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, a_position_dat);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(u_transformMatrix_loc, false, u_transformMatrix_dat);
    gl.drawArrays(primitiveType, 0, vertexCount);

    gl.disableVertexAttribArray(a_position_loc);
    //gl.disableVertexAttribArray(a_color_loc);
}

function drawTriangle() {
    gl.enableVertexAttribArray(u_texCoords_loc);
    gl.enableVertexAttribArray(a_position_loc);
    gl.uniform1i(u_textured_loc, true);

    u_sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");
    gl.uniform1i(u_sampler_loc, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);

    transformMatrixStack.push(mat4.clone(u_transformMatrix_dat));

    translate2D(-0.85, 0.8);
    gl.uniformMatrix4fv(u_transformMatrix_loc, false, u_transformMatrix_dat);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    u_transformMatrix_dat = transformMatrixStack.pop();

    gl.uniform1i(u_textured_loc, false);
    gl.disableVertexAttribArray(a_position_loc);
    gl.disableVertexAttribArray(u_texCoords_loc);
}

/**
 * Some of this needs to be split out into other functions
 */
function drawTexturedTriangles() {
    // set sampler to texture unit 0
    const sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    gl.vertexAttribPointer(a_position_loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangleIFSPosVBO);
    gl.vertexAttribPointer(a_position_loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSVBO);

    for (let i = 0; i < totalTriangles; i++) {
        transformMatrixStack.push(mat4.clone(u_transformMatrix_dat));

        // random texture unit
        const texUnit = Math.floor(Math.random() * 2);
        gl.uniform1i(sampler_loc, texUnit);

        // bounded random location
        const dx = Math.random() * 1.4;
        const dy = Math.random() * -1.7;
        translate2D(dx - 0.55, dy + 0.85); // the math is because I don't compile translations

        gl.uniformMatrix4fv(u_transformMatrix_loc, false, u_transformMatrix_dat);
        gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_BYTE, 0); // all triangles

        u_transformMatrix_dat = transformMatrixStack.pop();
    }
}


function drawPyramid() {
    
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
 * , 1.0
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

    drawBasicObject(gl.TRIANGLE_FAN, [1, 0, 0, 1],
        [-0.25,-0.25,0.25, 0.25,-0.25,0.25, 0.25,0.25,0.25, -0.25,0.25,0.25]);
    drawBasicObject(gl.TRIANGLE_FAN, [0, 1, 1, 1],
        [ -0.25,-0.25,-0.25, -0.25,0.25,-0.25, 0.25,0.25,-0.25, 0.25,-0.25,-0.25]);
    drawBasicObject(gl.TRIANGLE_FAN, [1, 1, 0, 1],
        [ -0.25,0.25,-0.25, -0.25,0.25,0.25, 0.25,0.25,0.25, 0.25,0.25,-0.25 ]);
    drawBasicObject(gl.TRIANGLE_FAN, [1, 0, 1, 1],
        [ -0.25,-0.25,-0.25, 0.25,-0.25,-0.25, 0.25,-0.25,0.25, -0.25,-0.25,0.25 ]);
    drawBasicObject(gl.TRIANGLE_FAN, [0, 1, 0, 1],
        [ 0.25,-0.25,-0.25, 0.25,0.25,-0.25, 0.25,0.25,0.25, 0.25,-0.25,0.25 ]);
    drawBasicObject(gl.TRIANGLE_FAN, [1, 1, 1, 1],
        [ -0.25,-0.25,-0.25, -0.25,-0.25,0.25, -0.25,0.25,0.25, -0.25,0.25,-0.25 ]);

    drawTriangle();
    //drawTexturedTriangles();

    mat4.rotateX(u_transformMatrix_dat, u_transformMatrix_dat, Math.PI/27);
    mat4.rotateY(u_transformMatrix_dat, u_transformMatrix_dat, Math.PI/13);

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
        const log = gl.getShaderInfoLog(vertexShader);
        console.error("Vertex shader error: ", log);
        return;
    }

    const fragmentShader =  /** @type {WebGLShader} */ gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(fragmentShader);
        console.error("Fragment shader error: ", log);
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

function rotatorCallback() {
    const viewMatrix = new Float32Array(rotator.getViewMatrix());
    console.log("callback\n", viewMatrix);
}

function initGL() {
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
    gl.useProgram(shaderProgram);
    
    u_modelview_loc = gl.getUniformLocation(shaderProgram, "modelview");
    u_projection_loc = gl.getUniformLocation(shaderProgram, "projection");
    u_transformMatrix_loc = gl.getUniformLocation(shaderProgram, "transformMatrix");
    u_textured_loc = gl.getUniformLocation(shaderProgram, "textured");
    u_sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");
    a_color_loc = gl.getAttribLocation(shaderProgram, "color");
    a_position_loc = gl.getAttribLocation(shaderProgram, "position");

    u_modelview_dat = mat4.create();

    u_projection_dat = mat4.create();
    mat4.perspective(u_projection_dat, Math.PI/4, aspect, 0.1, 5);
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);
    gl.uniformMatrix4fv(u_projection_loc, false, u_projection_dat);

    u_transformMatrix_dat = mat4.create();
    // move the scene into viewable range
    mat4.translate(u_transformMatrix_dat, u_transformMatrix_dat, [0, 0, -3, 0]);
    mat4.scale(u_transformMatrix_dat, u_transformMatrix_dat, [1, 1, 1]);
    gl.uniformMatrix4fv(u_transformMatrix_loc, false, u_transformMatrix_dat);

    transformMatrixStack = [];

    rotator = new SimpleRotator(canvas, rotatorCallback, 10);

    frameTime = 1000;
    lastT = now.getMilliseconds() - frameTime; // ensure the first iteration doesn't wait
    animating = true;
    fpsSlider = document.getElementById('fps-slider');

    a_color_dat = gl.createBuffer();
    a_position_dat = gl.createBuffer();

    defineBasicTriangle();
    defineTriangleShape();
    loadTextures();

    animate();
}

async function init() {
    try {
        canvas = document.getElementById('webglcanvas');
        aspect = canvas.width / canvas.height;
        const canvas_options = {
            alpha: false,
            depth: true,
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
