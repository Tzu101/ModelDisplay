import { Matrix } from "./Matrix.js"
import { SceneRender } from "./SceneReader.js"
import { buildInModel } from "./Model.js"


// Global variables
let canvas;
let model;
let normals;
let model_projection;
let normals_projection;
let colors;

let position = [0, 0, 0];
let angle = [0, 0, 0];
let fov = [0.01];

let translation = [0, 0, 0];
let rotation = [0, 0, 0];
let scale = [1, 1, 1];

let material_color = [0.5, 0.5, 0.5];
let material_shine = 40.0;
let lights = [];


// Gets json data
function readJson() {

    let data;
    
    [model, normals, data] = SceneRender.readFromJson(document.getElementById("inputJson").value);

    if(model == null) return;

    // Set new parameters for camera, model and material
    copyArray(position, data.camera.translation);
    copyArray(angle, data.camera.rotation);
    copyArray(fov, [data.camera.perspective]);

    copyArray(translation, data.model.translation);
    copyArray(rotation, data.model.rotation);
    copyArray(scale, data.model.scale);

    copyArray(material_color, data.material.color);
    copyArray(material_shine, data.material.shininess);
    copyArray(lights, data.lights);

    // Inverse camera data
    inverseArray(position);
    inverseArray(angle);

    display();
}

function copyArray(original, data) {

    for(let i=0; i<data.length; i++) {
        original[i] = data[i];
    }
}

function inverseArray(original) {

    for(let i=0; i<original.length; i++) {
        original[i] = -original[i];
    }
}

function arraySwitchNineNext(array, index) {

    for (let i=0; i<9; i++) {
        let temp = array[index+i];
        array[index+i] = array[index+i+9];
        array[index+i+9] = temp;
    }
}

function parameterHotkey(parameter, index, change, keycode) {

    document.addEventListener("keydown", function(key) {

        if (key.keyCode == keycode) {
            parameter[index] += change;
            display();
        }
    });
}

// Displays model on screen
function display() {

    calculate();
    draw();
}

// Sorts verticies
function sort() {

    // Calculates distances to player
    let distances = [];
    for(let i=0; i < model_projection.length; i+=9) {
        let distx = Math.abs((model_projection[i] + model_projection[i+3] + model_projection[i+6]) / 3 - position[2]);
        let disty = Math.abs((model_projection[i+1] + model_projection[i+4] + model_projection[i+7]) / 3 - position[2]);
        let distz = Math.abs((model_projection[i+2] + model_projection[i+5] + model_projection[i+8]) / 3 - position[2]);
        distances.push(Math.sqrt(distx*distx + disty*disty + distz*distz));
    }

    // Sorts based on distance to player
    let sorted = false;
    while (!sorted) {
        for(let i=0; i < model_projection.length-9; i+=9) {

            sorted = true;
            let d = Math.floor(i/9);

            if (distances[d] > distances[d+1]) {

                arraySwitchNineNext(model_projection, i);
                arraySwitchNineNext(normals_projection, i);

                let temp = distances[d];
                distances[d] = distances[d+1];
                distances[d+1] = temp;
                
                sorted = false;
                break;
            }
        }
    }
}

// Applies lighting
function lighting() {

    colors = [];

    let len = lights.length;

    let mp = model_projection;
    let np = normals_projection;
    let cp = position;
    for(let i=0; i < model_projection.length; i+=9) {

        let tri_col = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        let lp, ld, lv, ln, no, nv, nn, dot, lc, lr, cd, cv, cn, dotk, dots;

        for (let j=0; j<3; j++) {

            for (let l=0; l<len; l++) {

                lp = lights[l].position;
                ld = [lp[0] - mp[i + 3*j], lp[1] - mp[i+1 + 3*j], lp[2] - mp[i+2 + 3*j]];
                lv = Math.sqrt(ld[0]*ld[0] + ld[1]*ld[1] + ld[2]*ld[2]);
                ln = [ld[0] / lv, ld[1] / lv, ld[2] / lv];
                no = [np[i + 3*j], np[i+1 + 3*j], np[i+2 + 3*j]];
                nv = Math.sqrt(no[0]*no[0] + no[1]*no[1] + no[2]*no[2]);
                nn = [no[0] / nv, no[1] / nv, no[2] / nv];
                dot = ln[0] * nn[0] + ln[1] * nn[1] + ln[2] * nn[2];
                lc = lights[l].color;
               
                if (dot > 0) {
                    tri_col[j][0] += dot * lc[0];
                    tri_col[j][1] += dot * lc[1];
                    tri_col[j][2] += dot * lc[2];
                }

                lr = [ln[0] - 2*dot*nn[0], ln[1] - 2*dot*nn[1], ln[2] - 2*dot*nn[2]];
                cd = [cp[0] - mp[i + 3*j], cp[1] - mp[i+1 + 3*j], cp[2] - mp[i+2 + 3*j]];
                cv = Math.sqrt(cd[0]*cd[0] + cd[1]*cd[1] + cd[2]*cd[2]);
                cn = [cd[0] / cv, cd[1] / cv, cd[2] / cv];
                dotk = lr[0] * cn[0] + lr[1] * cn[1] + lr[2] * cn[2];
                dots = Math.pow(dotk, material_shine);

                if (dotk > 0) {
                    tri_col[j][0] += dots * lc[0];
                    tri_col[j][1] += dots * lc[1];
                    tri_col[j][2] += dots * lc[2];
                }
            }
        }

        colors.push([   (tri_col[0][0] + tri_col[1][0] + tri_col[2][0]) / 3 * material_color[0],
                        (tri_col[0][1] + tri_col[1][1] + tri_col[2][1]) / 3 * material_color[1],
                        (tri_col[0][2] + tri_col[1][2] + tri_col[2][2]) / 3 * material_color[2]]);
    }
}

// Calculates the transformation matrix for the model
function calculate() {

    // Camera matrix
    let camera = Matrix.identity();
    camera = Matrix.multiply(camera, Matrix.rotateZ(angle[2]));
    camera = Matrix.multiply(camera, Matrix.rotateY(angle[1]));
    camera = Matrix.multiply(camera, Matrix.rotateX(angle[0]));
    camera = Matrix.multiply(camera, Matrix.translate(position[0], position[1], position[2]));
    camera = Matrix.multiply(Matrix.perspective(fov[0]), camera);

    // Model projection matrix
    let matrix = Matrix.identity();
    matrix = Matrix.multiply(matrix, Matrix.translate(translation[0], translation[1], translation[2]));
    matrix = Matrix.multiply(matrix, Matrix.rotateX(rotation[0]));
    matrix = Matrix.multiply(matrix, Matrix.rotateY(rotation[1]));
    matrix = Matrix.multiply(matrix, Matrix.rotateZ(rotation[2]));
    matrix = Matrix.multiply(matrix, Matrix.scale(scale[0], scale[1], scale[2]));

    // Rotation matrix for normals
    let rotate = Matrix.identity();
    rotate = Matrix.multiply(rotate, Matrix.rotateX(rotation[0]));
    rotate = Matrix.multiply(rotate, Matrix.rotateY(rotation[1]));
    rotate = Matrix.multiply(rotate, Matrix.rotateZ(rotation[2]));
    rotate = Matrix.multiply(rotate, Matrix.transpose(Matrix.invert(Matrix.scale(scale[0], scale[1], scale[2]))));

    // Calculates coordinated in space with projection matrix
    model_projection = [...model];
    normals_projection = [...normals];
    for(let i=0; i < model.length; i+=3) {
        let newVector1 = Matrix.vector([model[i], model[i+1], model[i+2]], matrix);
        model_projection[i] = newVector1[0];
        model_projection[i+1] = newVector1[1];
        model_projection[i+2] = newVector1[2];

        let newVector2 = Matrix.vector([normals[i], normals[i+1], normals[i+2]], rotate);
        normals_projection[i] = newVector2[0];
        normals_projection[i+1] = newVector2[1];
        normals_projection[i+2] = newVector2[2];
    }

    sort();
    lighting();

    // Calculates coordinated on canvas with camera matrix
    for(let i=0; i < model.length; i+=3) {
        let newVector = Matrix.vector([model_projection[i], model_projection[i+1], model_projection[i+2]], camera);
        model_projection[i] = newVector[0];
        model_projection[i+1] = newVector[1];
        model_projection[i+2] = newVector[2];
    }
}

// Displays model on canvas
function draw() {

    canvas.clearRect(0, 0, 800, 600);

    // Draw triangles and lines
    for(let i=0; i < model_projection.length; i+=9) {

        let c = Math.floor(i/9);
        canvas.fillStyle = `rgb(
            ${colors[c][0] * 255},
            ${colors[c][1] * 255},
            ${colors[c][2] * 255})`;    

        canvas.beginPath();
        canvas.moveTo(model_projection[i] + 400, model_projection[i + 1] + 300);

        canvas.lineTo(model_projection[i + 3] + 400, model_projection[i + 4] + 300);
        canvas.lineTo(model_projection[i + 6] + 400, model_projection[i + 7] + 300);

        canvas.fill();
        canvas.stroke();
    }
}

// Initial function
function start() {

    // Removes scrolling with arrow keys
    window.addEventListener("keydown", function(e) {
        if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
            e.preventDefault();
        }
    }, false);

    // Get the canvas context
    canvas = document.querySelector("canvas").getContext("2d");
    document.getElementById("readJson").addEventListener("click", readJson);

    // Model parameters
    parameterHotkey(translation, 0, 0.1, 65);
    parameterHotkey(translation, 0, -0.1, 68);

    parameterHotkey(translation, 1, -0.1, 87);
    parameterHotkey(translation, 1, 0.1, 83);

    parameterHotkey(rotation, 0, 0.1, 37);
    parameterHotkey(rotation, 0, -0.1, 39);

    parameterHotkey(rotation, 1, -0.1, 38);
    parameterHotkey(rotation, 1, 0.1, 40);

    parameterHotkey(rotation, 2, -0.1, 49);
    parameterHotkey(rotation, 2, 0.1, 50);

    // Position reset
    document.addEventListener("keydown", function(key) {

        if (key.keyCode == 32) {
            copyArray(rotation, [-1.9, 6.1, 1.2]);
            display();
        }
    });

    // Initial model
    let data;
    
    [model, normals, data] = SceneRender.readFromJson(buildInModel);

    if(model == null) return;

    // Set new parameters for camera, model and material
    copyArray(position, data.camera.translation);
    copyArray(angle, data.camera.rotation);
    copyArray(fov, [data.camera.perspective]);

    copyArray(translation, data.model.translation);
    copyArray(rotation, data.model.rotation);
    copyArray(scale, data.model.scale);

    copyArray(material_color, data.material.color);
    copyArray(material_shine, data.material.shininess);
    copyArray(lights, data.lights);

    // Inverse camera data
    inverseArray(position);
    inverseArray(angle);

    display();
}

start();
