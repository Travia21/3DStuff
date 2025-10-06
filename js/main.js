"use strict";

import * as SHAPES from "./objects/shapes.js";

// unfortunately necessary until I figure out how JS actually works
const { mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 } = glMatrix;

var vertexShaderSource;
var fragmentShaderSource;

// I much prefer working with types, even if they are annotations
var canvas = /** @type {HTMLCanvasElement} */ document.getElementById("webglcanvas");
var aspect;

/** @type {WebGL2RenderingContext} */
var gl;

/** @type {WebGLProgram} */
var shaderProgram;

/** @type {mat4} */
var u_modelview_loc, u_projection_loc;
var u_modelview_dat, u_projection_dat;
var modelviewStack;
// u_modelview_dat is maintained by rotator's view matrix

/** @type {SimpleRotator} */
var rotator;
var rotateX, rotateY, rotateZ;

/** @type {WebGLBuffer} */
var triangleColorVBO, trianglePositionVBO;

/** @type {GLint} */
var u_fragColor_loc, a_position_loc;
var u_fragColor_dat, a_position_dat;
var u_textured_loc, u_sampler_loc;
var u_texCoords_loc;
var u_normalMatrix_dat, u_normalMatrix_loc;
var u_lit_loc;
var u_lights_loc, u_lights_dat;
var u_frontMaterial_loc, u_backMaterial_loc;

var lightPositions = [
    [0,0,0,1], [0,0,1,0], [0,1,0,0], [0,0,-10,1], [2,3,5,0]
];

function translate2D(/** @type {float} */ dx, /** @type {float} */ dy) {
    mat4.translate(u_modelview_dat, u_modelview_dat, [dx, dy, 0.0, 0.0]);
}

function rotate2D(/** @type {float} */ radians) {
    mat4.rotate(u_modelview_dat, u_modelview_dat, radians, [0, 1, 0]);
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
        -0.15, -0.10, +0.0,
        +0.15, -0.10, +0.0,
        +0.00, +0.20, +0.0
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

function drawTriangle() {
    gl.enableVertexAttribArray(u_texCoords_loc);
    gl.enableVertexAttribArray(a_position_loc);
    gl.uniform1i(u_textured_loc, true);

    u_sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");
    gl.uniform1i(u_sampler_loc, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePositionVBO);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);

    translate2D(-0.85, 0.8);
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.uniform1i(u_textured_loc, false);
    gl.disableVertexAttribArray(a_position_loc);
    gl.disableVertexAttribArray(u_texCoords_loc);
}

function drawSphere(radius, slices, stacks) {
    // Draw sphere
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);

    gl.uniform1i(u_lit_loc, true);

    mat4.translate(u_modelview_dat, u_modelview_dat, [0.5, -0.5, 0]);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, Math.PI/7);
    drawModel(SHAPES.uvSphere(radius, slices, stacks), false);

    gl.uniform1i(u_lit_loc, false);

    gl.disable(gl.CULL_FACE);
    u_modelview_dat = modelviewStack.pop();
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
    frameTime = 1000 / fpsSlider.value;
    dT = now.getMilliseconds() - lastT;
    lastT = now.getMilliseconds();
    if (dT < frameTime) { // 1 second
        await new Promise(r => setTimeout(r, frameTime - dT));
    }

    if (!animating) { return; }

    // I don't want weird floating point errors accumulating at any point
    rotateY = (rotateY + 0.05) % (2*Math.PI);

    draw();

    requestAnimationFrame(animate);
}

function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    u_modelview_dat = rotator.getViewMatrix();
    // Apply manual rotations from keyboard
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotateX);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotateY);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotateZ);
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);

    // Transform light coordinates and spotlight directions
    // to eye coordinates
    // light index 0 is always the eye light
    for (let i = 1; i < u_lights_loc.length; i++) {
        const newPos = new Float32Array(4);
        const newDir = vec3.create();
        vec4.transformMat4(newPos, u_lights_dat[i].position, u_modelview_dat);
        gl.uniform4fv(u_lights_loc[i].position, newPos);
        if (Object.hasOwn(u_lights_dat[i], "spotDirection")) {
            vec3.transformMat3(newDir,
                u_lights_dat[i].spotDirection,
                mat3.normalFromMat4(mat3.create(), u_modelview_dat)
            );
            gl.uniform3fv(u_lights_loc[i].spotDirection, newDir);
            console.log(newDir);
        }
    }

    // Draw 2D textured triangle
    modelviewStack.push(mat4.clone(u_modelview_dat));
    drawTriangle();
    u_modelview_dat = modelviewStack.pop();

    gl.uniform3f( u_frontMaterial_loc.diffuseColor, 1.0, 1.0, 1.0 );
    gl.uniform3f( u_frontMaterial_loc.specularColor, 0.2, 0.2, 0.2 );
    gl.uniform1f( u_frontMaterial_loc.specularExponent, 32 );

    gl.uniform3f( u_backMaterial_loc.diffuseColor, 0, 0.5, 0.25 );
    gl.uniform3f( u_backMaterial_loc.specularColor, 0.1, 0.1, 0.1 );
    gl.uniform1f( u_backMaterial_loc.specularExponent, 32 );

    drawSphere(0.35, 32, 16);
}

var a_normal_loc;
var a_normal_dat, index_buffer;
function drawModel(modelData, /** @type {bool} */ splines) {
    gl.enableVertexAttribArray(a_position_loc);
    gl.enableVertexAttribArray(a_normal_loc);

    gl.bindBuffer(gl.ARRAY_BUFFER, a_position_dat);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexPositions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, a_normal_dat);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexNormals, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_normal_loc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, modelData.indices, gl.STATIC_DRAW);

    mat3.normalFromMat4(u_normalMatrix_dat, u_modelview_dat);
    gl.uniformMatrix3fv(u_normalMatrix_loc, false, u_normalMatrix_dat);
    gl.uniformMatrix4fv(u_projection_loc, false, u_projection_dat);

    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);
    gl.drawElements(gl.TRIANGLES, modelData.indices.length, gl.UNSIGNED_SHORT, 0);

    if (splines) {
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1,1);
        gl.uniform3f(u_frontMaterial_loc.diffuseColor, 0,0,0,1);
        gl.drawElements(gl.LINES, modelData.indices.length, gl.UNSIGNED_SHORT, 0);
        gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    gl.disableVertexAttribArray(a_position_loc);
    gl.disableVertexAttribArray(a_normal_loc);
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

function keyListener(event) {
    switch (event.keyCode) {
        case 37: rotateY = (rotateY - 0.05) % (2*Math.PI); break;        // left arrow
        case 39: rotateY = (rotateY + 0.05) % (2*Math.PI); break;       // right arrow
        case 38: rotateX = (rotateX - 0.05) % (2*Math.PI); break;        // up arrow
        case 40: rotateX = (rotateX + 0.05) % (2*Math.PI); break;        // down arrow
        case 33: rotateZ = (rotateZ + 0.05) % (2*Math.PI); break;        // PageUp
        case 34: rotateZ = (rotateZ - 0.05) % (2*Math.PI); break;        // PageDown
        case 13:                                // return key
        case 36: rotateX = rotateY = rotateZ = 0; break;  // home key
        default: {
            event.preventDefault();
            console.log("key: ", event.keyCode);
            return;
        }
    }

    draw();
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

    rotator = new SimpleRotator(canvas, draw, 3);
    
    u_modelview_loc = gl.getUniformLocation(shaderProgram, "modelview");
    u_projection_loc = gl.getUniformLocation(shaderProgram, "projection");
    u_textured_loc = gl.getUniformLocation(shaderProgram, "textured");
    u_sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");

    u_lit_loc = gl.getUniformLocation(shaderProgram, "lit");
    u_lights_loc = new Array(4);
    for (let i = 0; i < u_lights_loc.length; i++) {
        u_lights_loc[i] = {
            enabled: gl.getUniformLocation(shaderProgram, "lights[" + i + "].enabled"),
            position: gl.getUniformLocation(shaderProgram, "lights[" + i + "].position"),
            color: gl.getUniformLocation(shaderProgram, "lights[" + i + "].color"),
            spotDirection: gl.getUniformLocation(shaderProgram, "lights[" + i + "].spotDirection"),
            spotCutoff: gl.getUniformLocation(shaderProgram, "lights[" + i + "].spotCutoff"),
            spotExponent: gl.getUniformLocation(shaderProgram, "lights[" + i + "].spotExponent"),
        };
    }

    u_frontMaterial_loc = {
        diffuseColor: gl.getUniformLocation(shaderProgram, "frontMaterial.diffuseColor"),
        specularColor: gl.getUniformLocation(shaderProgram, "frontMaterial.specularColor"),
        specularExponent: gl.getUniformLocation(shaderProgram, "frontMaterial.specularExponent")
    };

    u_backMaterial_loc = {
        diffuseColor: gl.getUniformLocation(shaderProgram, "backMaterial.diffuseColor"),
        specularColor: gl.getUniformLocation(shaderProgram, "backMaterial.specularColor"),
        specularExponent: gl.getUniformLocation(shaderProgram, "backMaterial.specularExponent")
    };

    u_fragColor_loc = gl.getAttribLocation(shaderProgram, "fragColor");
    a_position_loc = gl.getAttribLocation(shaderProgram, "position");
    a_normal_loc = gl.getAttribLocation(shaderProgram, "a_normal");
    u_normalMatrix_loc = gl.getUniformLocation(shaderProgram, "normalMatrix");

    u_normalMatrix_dat = mat3.create();

    u_lights_dat = [];
    // Eye camera point light
    u_lights_dat[0] = {
        enabled: true,
        position: [0.0, 0.0, 3.0, 1.0],
        color: [0.5, 0.5, 0.5],
    };

    // Triangle to sphere spotlight
    u_lights_dat[1] = {
        enabled: true,
        position: [-0.85, 0.8, 0.0, 1.0],
        color: [0.0, 0.0, 1.0],
        spotDirection: [1.35, -1.3, 0], // triangle to sphere
        spotCutoff: glMatrix.glMatrix.toRadian(10), // these two numbers took some
        spotExponent: 90,                           // trial and error
    };

    // back-to-front directional light
    u_lights_dat[2] = {
        enabled: true,
        position: [0, 0, -1, 0.0],
        color: [1.0, 0.0, 0.0]
    };

    // point light
    u_lights_dat[3] = {
        enabled: true,
        position: [1.5, -0.5, 0.0, 1.0],
        color: [0.0, 0.3, 0.0]
    };

    for (var i = 0; i < u_lights_loc.length; i++) {
        gl.uniform1i(u_lights_loc[i].enabled, u_lights_dat[i].enabled ); 
        gl.uniform4fv(u_lights_loc[i].position, u_lights_dat[i].position);
        gl.uniform3fv(u_lights_loc[i].color, u_lights_dat[i].color);

        if (Object.hasOwn(u_lights_dat[i], "spotDirection")) { // set spotlight values
            gl.uniform3fv(u_lights_loc[i].spotDirection, u_lights_dat[i].spotDirection);
            gl.uniform1f(u_lights_loc[i].spotCutoff, u_lights_dat[i].spotCutoff);
            gl.uniform1f(u_lights_loc[i].spotExponent, u_lights_dat[i].spotExponent);
        }
    }

    index_buffer = gl.createBuffer();

    u_modelview_dat = rotator.getViewMatrix();
    modelviewStack = [];
    rotateX = rotateY = rotateZ = 0.0;
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);

    u_projection_dat = mat4.create();
    mat4.perspective(u_projection_dat, Math.PI/4, aspect, 0.1, 10);
    gl.uniformMatrix4fv(u_projection_loc, false, u_projection_dat);

    frameTime = 1000;
    lastT = now.getMilliseconds() - frameTime; // ensure the first iteration doesn't wait
    animating = true;
    fpsSlider = document.getElementById('fps-slider');

    u_fragColor_dat = gl.createBuffer();
    a_position_dat = gl.createBuffer();
    a_normal_dat = gl.createBuffer();


    /////
    //u_diffuseColor_loc = gl.getUniformLocation(shaderProgram, "diffuseColor");
    //u_specularColor_loc = gl.getUniformLocation(shaderProgram, "specularColor");
    //u_specularExponent_loc = gl.getUniformLocation(shaderProgram, "specularExponent");
    //u_lightPosition_loc = gl.getUniformLocation(shaderProgram, "lightPosition");
    ///////

    //gl.uniform3f(u_specularColor_loc, 0.5, 0.5, 0.5);
    //gl.uniform4f(u_diffuseColor_loc, 1, 1, 1, 1);
    //gl.uniform1f(u_specularExponent_loc, 10);
    //gl.uniform4f(u_lightPosition_loc, -0.85, 0.8, 0.3, 1);

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

    document.addEventListener("keydown", keyListener, false);
}

window.onload = init;
