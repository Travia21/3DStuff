"use strict";

import * as SHAPES from "./objects/shapes.js";

// unfortunately necessary until I figure out how JS actually works
const { mat2, mat2d, mat3, mat4, quat, quat2, vec2, vec3, vec4 } = glMatrix;

var vertexShaderSource;
var fragmentShaderSource;

// I much prefer working with types, even if they are annotations
// Well.. I started off enforcing types, but it got too tedious given my lack of
// experience in Javascript
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

/** @type {SimpleRotator} */
var rotator;
var rotateX, rotateY, rotateZ;

// Starting positions
var modelview_start, projection_start;

/** @type {GLint} */
var u_fragColor_loc, a_position_loc;
var u_fragColor_dat, a_position_dat;
var u_textured_loc, u_sampler_loc;
var u_texCube_loc, u_samplerCube_loc;
var a_texCoords_loc, a_texCoords_dat;
var u_normalMatrix_dat, u_normalMatrix_loc;
var u_lit_loc;
var u_lights_loc, u_lights_dat;
var u_frontMaterial_loc, u_backMaterial_loc;

var triangleIFSBuffer;
var trianglePosBuffer;
var triangle_tex_pos_buffer;
function defineTriangleShape() {
    triangleIFSBuffer = gl.createBuffer();
    trianglePosBuffer = gl.createBuffer();
    triangle_tex_pos_buffer = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSBuffer);
    const indexedFaceSet = new Uint8Array([0, 1, 2]);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexedFaceSet, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangle_tex_pos_buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([0.0, 0.0,  1.0, 0.0,  0.5, 1.0]), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePosBuffer);
    const triangleVertices = new Float32Array([
        -0.15, -0.10, +0.0,
        +0.15, -0.10, +0.0,
        +0.00, +0.20, +0.0
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
}

function drawSample() {
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enableVertexAttribArray(a_texCoords_loc);
    gl.enableVertexAttribArray(a_position_loc);
    gl.uniform1i(u_lit_loc, false);

    const testing = gl.getUniformLocation(shaderProgram, "testing");
    gl.uniform1i(testing, true);

    gl.uniform1i(u_samplerCube_loc, 1);
    gl.uniform1i(u_sampler_loc, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangle_tex_pos_buffer);
    gl.vertexAttribPointer(a_texCoords_loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePosBuffer);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSBuffer);

    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);
    gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_BYTE, 0);

    gl.uniform1i(testing, false);
    gl.disableVertexAttribArray(a_position_loc);
    gl.disableVertexAttribArray(a_texCoords_loc);
    u_modelview_dat = modelviewStack.pop();
}

function drawTriangle(position, rotation) {
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enableVertexAttribArray(a_texCoords_loc);
    gl.enableVertexAttribArray(a_position_loc);
    gl.uniform1i(u_lit_loc, false);
    gl.uniform1i(u_textured_loc, true);

    gl.uniform1i(u_samplerCube_loc, 1);
    gl.uniform1i(u_sampler_loc, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, triangle_tex_pos_buffer);
    gl.vertexAttribPointer(a_texCoords_loc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, trianglePosBuffer);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleIFSBuffer);

    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);
    gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_BYTE, 0);

    gl.uniform1i(u_textured_loc, false);
    gl.disableVertexAttribArray(a_position_loc);
    gl.disableVertexAttribArray(a_texCoords_loc);
    u_modelview_dat = modelviewStack.pop();
}

var a_normal_loc;
var a_normal_dat, index_buffer;
function drawModel(modelData, /** @type {bool} */ splines) {
    gl.enableVertexAttribArray(a_position_loc);
    gl.enableVertexAttribArray(a_normal_loc);

    gl.bindBuffer(gl.ARRAY_BUFFER, a_position_dat);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexPositions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, a_texCoords_dat);
    gl.bufferData(gl.ARRAY_BUFFER, modelData.vertexTextureCoords, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_texCoords_loc, 2, gl.FLOAT, false, 0, 0);

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

// Template function, please ignore
function drawObject(position, rotation) {
    // HEADER
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(u_lit_loc, true);
    
    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);
    //drawModel(SHAPES.shape(), slices, stacks), false);

    // FOOTER
    gl.uniform1i(u_lit_loc, false);
    gl.disable(gl.CULL_FACE);
    u_modelview_dat = modelviewStack.pop();
}

function drawCube(side, position, rotation) {
    // HEADER
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(u_lit_loc, true);

    const cube = SHAPES.cube(side);

    // Set texture bools
    gl.uniform1i(u_textured_loc, true);
    gl.enableVertexAttribArray(a_texCoords_loc);
    gl.uniform1i(u_texCube_loc, true);

    // texture settings
    gl.uniform1i(u_samplerCube_loc, 1);

    // Transform and Draw
    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);
    drawModel(cube, false);

    // Unset texture bools
    gl.uniform1i(u_texCube_loc, false);
    gl.disableVertexAttribArray(a_texCoords_loc);
    gl.uniform1i(u_textured_loc, false);

    // FOOTER
    gl.uniform1i(u_lit_loc, false);
    gl.disable(gl.CULL_FACE);
    u_modelview_dat = modelviewStack.pop();
}

function drawRectanguloid(width, height, depth, position, rotation) {
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(u_lit_loc, true);
    
    // Set texture bools
    gl.uniform1i(u_textured_loc, true);
    gl.enableVertexAttribArray(a_texCoords_loc);

    // texture settings
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, monitor_texture);
    gl.uniform1i(u_samplerCube_loc, 1);
    gl.uniform1i(u_sampler_loc, 3);

    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);
    drawModel(SHAPES.rectanguloid(width, height, depth), false);

    // Unset texture bools
    gl.disableVertexAttribArray(a_texCoords_loc);
    gl.uniform1i(u_textured_loc, false);

    gl.uniform1i(u_lit_loc, false);
    gl.disable(gl.CULL_FACE);
    u_modelview_dat = modelviewStack.pop();
}

function drawSphere(radius, slices, stacks, position, rotation) {
    // HEADER
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(u_lit_loc, true);

    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);
    drawModel(SHAPES.uvSphere(radius, slices, stacks), false);

    // FOOTER
    gl.uniform1i(u_lit_loc, false);
    gl.disable(gl.CULL_FACE);
    u_modelview_dat = modelviewStack.pop();
}

function drawCylinder(radius, height, slices, noTop, noBottom, position, rotation) {
    // HEADER
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(u_lit_loc, true);

    //handle stupid error
    gl.uniform1i(u_samplerCube_loc, 1);
    gl.uniform1i(u_sampler_loc, 0);
    
    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);
    drawModel(SHAPES.uvCylinder(radius, height, slices, noTop, noBottom), false);

    // FOOTER
    gl.uniform1i(u_lit_loc, false);
    gl.disable(gl.CULL_FACE);
    u_modelview_dat = modelviewStack.pop();
}

function drawTorus(innerRadius, outerRadius, slices, stacks, position, rotation) {
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(u_lit_loc, true);

    //handle stupid error
    gl.uniform1i(u_samplerCube_loc, 1);
    gl.uniform1i(u_sampler_loc, 0);

    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);
    drawModel(SHAPES.uvTorus(innerRadius, outerRadius, slices, stacks), false);

    gl.uniform1i(u_lit_loc, false);
    gl.disable(gl.CULL_FACE);
    u_modelview_dat = modelviewStack.pop();
}

/**
 * This seems like a hierarchical definition of objects to me.
 */
function drawCoolThing(position, rotation) {
    // HEADER
    modelviewStack.push(mat4.clone(u_modelview_dat));
    gl.enable(gl.CULL_FACE);
    gl.uniform1i(u_lit_loc, true);
    
    mat4.translate(u_modelview_dat, u_modelview_dat, position);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotation[0]);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotation[1]);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotation[2]);

    // Draw 2D textured triangle
    gl.disable(gl.CULL_FACE);
    drawTriangle([-0.75, 0.5, 0.0], [0,0,0]);
    gl.enable(gl.CULL_FACE);

    // leg 1
    let cyl_rad = 0.01;
    let cyl_hgt = 0.3;
    let cyl_pos = [
        (cyl_rad/2) - 0.9,
        (cyl_hgt/2) + 0.1,
        0
    ];
    let cyl_rot = [Math.PI/2, 0, 0];
    drawCylinder(cyl_rad, cyl_hgt, 32, false, false, cyl_pos, cyl_rot);

    //leg2
    cyl_pos = [
        (cyl_rad/2) - 0.61,
        (cyl_hgt/2) + 0.1,
        0
    ];
    drawCylinder(cyl_rad, cyl_hgt, 32, false, false, cyl_pos, cyl_rot);

    // I gave up on the arms rotation after I learned what quaternions are for
    // I'll have to learn them later.
    //
    // Instead, I'm manually defining the order of rotations, which isn't very
    // structured and will quickly explode the complexity of the project.
    //
    // Luckily, quaternions weren't a requirement for this project.
    //arm1
    cyl_rad = 0.01;
    cyl_pos = [
        (cyl_hgt/2) - 0.7125,
        (cyl_rad/2) + 0.625,
        0
    ];
    modelviewStack.push(mat4.clone(u_modelview_dat));
    mat4.translate(u_modelview_dat, u_modelview_dat, cyl_pos);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, 15);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, Math.PI/2);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, Math.PI/2);
    drawCylinder(cyl_rad, cyl_hgt, 32, false, false, [0,0,0], [0,0,0]);
    u_modelview_dat = modelviewStack.pop();

    //arm2
    cyl_pos = [
        (cyl_hgt/2) - cyl_hgt - 0.7825,
        (cyl_rad/2) + 0.625,
        0
    ];
    mat4.translate(u_modelview_dat, u_modelview_dat, cyl_pos);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, -15);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, Math.PI/2);
    mat4.rotateX(u_modelview_dat, u_modelview_dat, Math.PI/2);
    //drawCylinder(cyl_rad, cyl_hgt, 32, false, false, cyl_pos, cyl_rot);
    drawCylinder(cyl_rad, cyl_hgt, 32, false, false, [0,0,0], [0,0,0]);

    // FOOTER
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
var fpsSlider, rotSlider, torus_slider;

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

    drawMonitorTexture();
    draw();

    // I don't want weird floating point errors accumulating at any point
    rotateY = (rotateY + (rotSlider.value/1000)) % (2*Math.PI);

    requestAnimationFrame(animate);
}

var monitor_texture;
function draw( rendered = false ) {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    u_modelview_dat = rotator.getViewMatrix();
    // Apply manual rotations from keyboard
    mat4.rotateX(u_modelview_dat, u_modelview_dat, rotateX);
    mat4.rotateY(u_modelview_dat, u_modelview_dat, rotateY);
    mat4.rotateZ(u_modelview_dat, u_modelview_dat, rotateZ);
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);

    // update point light
    u_lights_dat[3] = {
        enabled: true,
        position: [
            2.0 + (point_x.value/2.0),
            0.5 + (point_y.value/2.0),
            0.0 + (point_z.value/2.0),
            1.0
        ],
        color: [0.0, 1.0, 0.0]
    };

    // Transform light coordinates and spotlight directions
    // to eye coordinates
    // light index 0 is always the eye light
    for (let i = 1; i < u_lights_loc.length; i++) {
        const newPos = new Float32Array(4);
        const newDir = vec3.create();
        vec4.transformMat4(newPos, u_lights_dat[i].position, u_modelview_dat);
        gl.uniform4fv(u_lights_loc[i].position, newPos);

        // this one was tricky
        if (Object.hasOwn(u_lights_dat[i], "spotDirection")) {
            vec3.transformMat3(newDir,
                u_lights_dat[i].spotDirection,
                mat3.normalFromMat4(mat3.create(), u_modelview_dat)
            );
            gl.uniform3fv(u_lights_loc[i].spotDirection, newDir);
        }
    }

    // basic white texture
    gl.uniform3f( u_frontMaterial_loc.diffuseColor, 1.0, 1.0, 1.0 );
    gl.uniform3f( u_frontMaterial_loc.specularColor, 0.2, 0.2, 0.2 );
    gl.uniform1f( u_frontMaterial_loc.specularExponent, 32 );

    gl.uniform3f( u_backMaterial_loc.diffuseColor, 0, 0.5, 0.25 );
    gl.uniform3f( u_backMaterial_loc.specularColor, 0.1, 0.1, 0.1 );
    gl.uniform1f( u_backMaterial_loc.specularExponent, 32 );

    drawCube(0.2, [-0.4, -0.1, +0.8], [0, 0, 0]);
    drawSphere(0.2, 32, 16, [0.5, -0.5, 0], [Math.PI/7, 0, 0]);
    drawCylinder(0.02, 0.6, 32, false, false, [0, 0, 0], [Math.PI/2, 0, 0]);
    drawTorus(0.2, 0.1, 32, 16, [0, 0, 0], [Math.PI/2, 0, 0]);

    // My face
    drawCoolThing([0, 0, 0], [0, 0, 0]);

    if (!rendered) {
        drawRectanguloid(0.3, 0.3, 0.1, [-0.48, -0.32, +1.8], [0, 0, 0]);
    }
}

function resetScene() {
    const fmt = (v) => (v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3));

    console.log("Before Reset\n");
    console.log("Rotation\nX: ", rotateX, " Y: ", rotateY, " Z: ", rotateZ);
    console.log("Modelview\n");
    for (let i = 0; i < 4; i++) {
        const row = [
            fmt(u_modelview_dat[i]),
            fmt(u_modelview_dat[i + 4]),
            fmt(u_modelview_dat[i + 8]),
            fmt(u_modelview_dat[i + 12]),
        ];
        console.log(`  [${row.join(", ")}]`);
    }
    console.log("Projection\n");
    for (let i = 0; i < 4; i++) {
        const row = [
            fmt(u_projection_dat[i]),
            fmt(u_projection_dat[i + 4]),
            fmt(u_projection_dat[i + 8]),
            fmt(u_projection_dat[i + 12]),
        ];
        console.log(`  [${row.join(", ")}]`);
    }

    rotateX = rotateY = rotateZ = 0;
    u_modelview_dat = structuredClone(modelview_start);
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);
    u_projection_dat = structuredClone(projection_start);
    gl.uniformMatrix4fv(u_projection_loc, false, u_projection_dat);
}

/**************************** Input handlers **********************************/
function resize() {
    gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
}

function animateButton() {
    animating = !animating;
    if (animating) { animate(); }
}

function resetButton() {
    resetScene();
    draw();
}

function lightButton(event) {
    const index = event.target.dataset.index;
    u_lights_dat[index].enabled = !u_lights_dat[index].enabled;
    gl.uniform1i(u_lights_loc[index].enabled, u_lights_dat[index].enabled);
    draw();
}

var point_x, point_y, point_z, point_a;
function handleButtons() {
    fpsSlider = document.getElementById('fps-slider');
    rotSlider = document.getElementById('rotation-slider');
    torus_slider = document.getElementById('torus-slider');

    point_x = document.getElementById('point-x');
    point_y = document.getElementById('point-y');
    point_z = document.getElementById('point-z');
    point_a = document.getElementById('point-a');

    document.getElementById("animate-btn").addEventListener("click", animateButton);
    document.getElementById("reset-btn").addEventListener("click", resetButton);

    document.getElementById("light0-btn").addEventListener("click", lightButton);
    document.getElementById("light1-btn").addEventListener("click", lightButton);
    document.getElementById("light2-btn").addEventListener("click", lightButton);
    document.getElementById("light3-btn").addEventListener("click", lightButton);
}

function keyListener(event) {
    switch (event.keyCode) {
        case 37: rotateY = (rotateY - 0.05) % (2*Math.PI); break;        // left arrow
        case 39: rotateY = (rotateY + 0.05) % (2*Math.PI); break;       // right arrow
        case 38: rotateX = (rotateX - 0.05) % (2*Math.PI); break;        // up arrow
        case 40: rotateX = (rotateX + 0.05) % (2*Math.PI); break;        // down arrow
        case 33: rotateZ = (rotateZ + 0.05) % (2*Math.PI); break;        // PageUp
        case 34: rotateZ = (rotateZ - 0.05) % (2*Math.PI); break;        // PageDown
        case 13: break;                               // return key
        case 36: rotateX = rotateY = rotateZ = 0; break;  // home key
        default: {
            //event.preventDefault();
            //console.log("key: ", event.keyCode);
            return;
        }
    }

    draw();
}

/**************************** Shader compilation ******************************/
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

/**************************** Texture Loading ********************************/
var texture_pos_buffer;
function loadTextures() {
    //TEXTURE9
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

    //TEXTURE0
    const texMe = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); // activate texture unit 0
    loadImage(meURL, texMe); // load the image into the texture object

    //TEXTURE1
    const texClover = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    loadCubeImage(cloverURL, texClover);

    //UV attributes
    u_sampler_loc = gl.getUniformLocation(shaderProgram, "u_texture");
    u_samplerCube_loc = gl.getUniformLocation(shaderProgram, "u_textureCube");
    a_texCoords_loc = gl.getAttribLocation(shaderProgram, "tex_coords");
    texture_pos_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texture_pos_buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([0.0, 0.0,  1.0, 0.0,  1.0, 1.0]), gl.STATIC_DRAW);
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

function loadCubeImage(/** @type {URL} */ url, /** @type {WebGLTexture} */ textureObject) {
    const image = new Image();
    const texUnit = gl.getParameter(gl.ACTIVE_TEXTURE);

    image.onload = function() {
        gl.activeTexture(texUnit);
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, textureObject);
        try {
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, image);
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, image);
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, image);
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, image);
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, image);
            gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA,
                gl.UNSIGNED_BYTE, image);
        } catch (e) {
            console.error("Error loading cubemap\n", e);
            return;
        }
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    }

    image.src = url;
}

// I may need a depth buffer for this
function drawMonitorTexture() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, monitor_framebuffer);

    // HEADER
    gl.useProgram(shaderProgram);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.viewport(0, 0, 512, 512);
    gl.enable(gl.BLEND);

    // I need to fix the rendering here when trying to re-render the scene.
    // It maintains the modelview from the actual scene, rather than obeying
    // torus_slider.
    modelviewStack.push(mat4.clone(u_modelview_dat));

    // I'm not sure if the perspective has to change,
    // but I'll leave this here for now
    mat4.perspective(u_projection_dat, Math.PI/4, aspect, 0.1, 10);
    gl.uniformMatrix4fv(u_projection_loc, false, u_projection_dat);

    mat4.rotateX(u_modelview_dat, modelview_start, ((2*Math.PI)/torus_slider.value));
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);
    
    // draw stuff
    drawTorus(0.5, 0.1, 32, 16, [0,0,0], [0,0,0]);
    //draw(true);
    //drawSample();

    u_modelview_dat = modelviewStack.pop();

    //saveMonitorTextureAsImage();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // FOOTER
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

/**************************** Init Functions **********************************/
var monitor_framebuffer;
function initGL() {
    now = new Date();
    window.addEventListener('resize', resize);
    resize();

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
    u_texCube_loc = gl.getUniformLocation(shaderProgram, "texCube");
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

    u_fragColor_loc = gl.getUniformLocation(shaderProgram, "fragColor");
    a_position_loc = gl.getAttribLocation(shaderProgram, "position");
    a_normal_loc = gl.getAttribLocation(shaderProgram, "a_normal");
    u_normalMatrix_loc = gl.getUniformLocation(shaderProgram, "normalMatrix");

    u_normalMatrix_dat = mat3.create();
    a_texCoords_dat = gl.createBuffer();

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
        position: [2.0, 0.5, 0.0, 1.0],
        color: [0.0, 1.0, 0.0]
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

    gl.activeTexture(gl.TEXTURE3);
    monitor_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, monitor_texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    monitor_framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, monitor_framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
        monitor_texture, 0);

    if (gl.getError() != gl.NO_ERROR) {
        throw "Framebuffer creation error";
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    u_modelview_dat = rotator.getViewMatrix();
    modelviewStack = [];
    rotateX = rotateY = rotateZ = 0.0;
    gl.uniformMatrix4fv(u_modelview_loc, false, u_modelview_dat);

    u_projection_dat = mat4.create();
    mat4.perspective(u_projection_dat, Math.PI/4, aspect, 0.1, 10);
    gl.uniformMatrix4fv(u_projection_loc, false, u_projection_dat);

    u_fragColor_dat = gl.createBuffer();
    a_position_dat = gl.createBuffer();
    a_normal_dat = gl.createBuffer();

    frameTime = 1000;
    lastT = now.getMilliseconds() - frameTime; // ensure the first iteration doesn't wait
    animating = true;

    modelview_start = structuredClone(u_modelview_dat);
    projection_start = structuredClone(u_projection_dat);

    defineTriangleShape();
    loadTextures();
    handleButtons();
    drawMonitorTexture();
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

function saveMonitorTextureAsImage() {
    const width = 512;
    const height = 512;

    // 1. Bind the framebuffer that rendered into monitor_texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, monitor_framebuffer);

    // 2. Read pixels from GPU into CPU memory
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // 3. Create a 2D canvas to draw the pixels
    const canvas2D = document.createElement('canvas');
    canvas2D.width = width;
    canvas2D.height = height;
    const ctx = canvas2D.getContext('2d');

    // 4. WebGL origin is bottom-left; Canvas origin is top-left.
    // We must flip the rows vertically.
    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
        const srcStart = (height - y - 1) * width * 4;
        const destStart = y * width * 4;
        imageData.data.set(pixels.subarray(srcStart, srcStart + width * 4), destStart);
    }

    ctx.putImageData(imageData, 0, 0);

    // 5. Convert the canvas to a data URL (or Blob)
    const dataURL = canvas2D.toDataURL("image/png");

    // (optional) trigger download
    const link = document.createElement('a');
    link.download = 'monitor_texture.png';
    link.href = dataURL;
    link.click();

    // Unbind framebuffer so we don't mess up rendering
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return dataURL;
}

window.onload = init;
