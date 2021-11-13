/**
 * Created by mpirdis on 11/04/2017. Updated by davay on 21/03/2019
 */

function Metaballs(gl, config, targetScreenSize,layerId){

    var program;
    var metaballsObjects = [];
    var metaballsObjectsHandle;
    var timeUniform;
    var resolutionUniform;
    var time = 0.0;
    var pause = false;
    var colorTexture;
    var noiseTexture;
    var animationProperties = {
        radiusMultiplier:0.0,
        positionMultiplier:0
    };
    var mousePosition = {x:0, y:0};
    targetScreenSize = targetScreenSize != undefined ? targetScreenSize : null;


    function getRandomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    function initializeShader(){

        var vertexShaderSource = compileShader(document.getElementById('vertexMetaballs').textContent, gl.VERTEX_SHADER);
        var fragmentShaderSource = compileShader(document.getElementById('fragmentMetaballs').textContent, gl.FRAGMENT_SHADER);

        program = gl.createProgram();
        gl.attachShader(program, vertexShaderSource);
        gl.attachShader(program, fragmentShaderSource);
        gl.linkProgram(program);
        gl.useProgram(program);

        /**
         * Geometry setup
         */
            // Set up 4 vertices, which we'll draw as a rectangle
            // via 2 triangles
            //
            //   A---C
            //   |  /|
            //   | / |
            //   |/  |
            //   B---D
            //
            // We order them like so, so that when we draw with
            // gl.TRIANGLE_STRIP, we draw triangle ABC and BCD.
        var vertexData = new Float32Array([
                -1.0,  1.0, // top left
                -1.0, -1.0, // bottom left
                1.0,  1.0, // top right
                1.0, -1.0, // bottom right
            ]);
        var vertexDataBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);


        // To make the geometry information available in the shader as attributes, we
        // need to tell WebGL what the layout of our data in the vertex buffer is.
        var positionHandle = getAttribLocation(program, 'position');

        gl.enableVertexAttribArray(positionHandle);
        gl.vertexAttribPointer(positionHandle,
            2, // position is a vec2
            gl.FLOAT, // each component is a float
            gl.FALSE, // don't normalize values
            2 * 4, // two 4 byte float components per vertex
            0 // offset into each span of vertex data
        );



        /**
         * SETUP UNIFORMS
         */
        metaballsObjectsHandle = getUniformLocation(program, 'metaballs');

        timeUniform = getUniformLocation(program, 'uTime');
        gl.uniform1f (timeUniform,  0.0);


        colorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT );
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, config.texture);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.uniform1i(gl.getUniformLocation(program, 'uColorSampler'), 0);

        resolutionUniform = getUniformLocation(program, 'uResolution');
        gl.uniform2f (resolutionUniform,  gl.canvas.width, gl.canvas.height);
    }

    /**
     * SHADER INITIALIZATION
     */
    // Utility to fail loudly on shader compilation failure
    function compileShader(shaderSource, shaderType) {
        var shader = gl.createShader(shaderType);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
        }
        return shader;
    }


    /**
     * Attribute setup
     */
    // Utility to complain loudly if we fail to find the attribute
    function getAttribLocation(program, name) {
        var attributeLocation = gl.getAttribLocation(program, name);
        if (attributeLocation === -1) {
            throw 'Can not find attribute ' + name + '.';
        }
        return attributeLocation;
    }


    /**
     * Uniform setup
     */
    // Utility to complain loudly if we fail to find the uniform
    function getUniformLocation(program, name) {
        var uniformLocation = gl.getUniformLocation(program, name);
        if (uniformLocation === -1) {
            throw 'Can not find uniform ' + name + '.';
        }
        return uniformLocation;
    }


    /**
     *  Attributes setup
     */
    var dataToSendToGPU;
    function setupAttributes(){
        time += 0.01;
        var count = config.metaballs.length;
        var centerX = displayWidth * .5;
        var centerY = displayHeight * .5;

        var radius = 10;
        for (var i = 0; i < count; i++) {
            var mb = config.metaballs[i];
            mb.x = centerX + (mb.centerOffsetX);// * animationProperties.positionMultiplier;
            mb.y = centerY + (mb.centerOffsetY);// * animationProperties.positionMultiplier;
            mb.targRadius = mb.radius + (( Math.cos( ( mb.t + time ) * mb.speed ) * 5 ) + ( Math.sin( ( mb.t + time ) * mb.speed ) * 5 ));// * animationProperties.positionMultiplier;
        }

        dataToSendToGPU = new Float32Array(3 * (count+1));
        var lastIndex, lastRadius;
        for (var i = 0; i < count; i++) {
            var baseIndex = 3 * i;
            var mb = metaballsObjects[i];
            lastIndex = baseIndex;
            lastRadius = mb.radius;
            dataToSendToGPU[baseIndex + 0] = mb.x;
            dataToSendToGPU[baseIndex + 1] = mb.y;
            dataToSendToGPU[baseIndex + 2] = mb.radius;// * animationProperties.radiusMultiplier;
            //dataToSendToGPU[baseIndex + 2] = mb.targRadius * animationProperties.radiusMultiplier;
        }
        gl.uniform3fv(metaballsObjectsHandle, dataToSendToGPU);
    }
    /**
     * Simulation setup
     */
    function setupSimulation(){
        metaballsObjects = config.metaballs;
        var metaball;
        var centerX = displayWidth * .5;
        var centerY = displayHeight * .5;
        for(var i = 0, total = metaballsObjects.length; i < total; i++){
            metaball = metaballsObjects[i];
            metaball.ox = metaball.x = centerX + metaball.centerOffsetX;
            metaball.oy = metaball.y = centerY + metaball.centerOffsetY;
        }
    }

    this.fadeIn = function(){
        //TweenMax.to(animationProperties, 2.0, {radiusMultiplier:1.0, delay:0., ease:Elastic.easeOut.config(1, 0.4) });
        //TweenMax.to(animationProperties, 1.7, {radiusMultiplier:1.0, delay:0., ease:Power2.easeInOut });
        //TweenMax.to(animationProperties, 2.4, {positionMultiplier:1.0, delay:0.0, ease:Power1.easeInOut});
        TweenMax.to(animationProperties, 2, {radiusMultiplier:1.0, delay:0, ease:{_p1: 1.70158,_p2: 2.5949095}});
        TweenMax.to(animationProperties, 5, {positionMultiplier:1.0, delay:0, ease:{_p1: 1.70158,_p2: 2.5949095}});
    }

    /**
     * Handle Resize
     */
    this.handleResize = function(width, height){
        gl.useProgram(program);
        gl.uniform2f (resolutionUniform,  width, height);
    }

    /**
     * Handle Mouse Move
     */
    this.handleMouseMove = function(x, y){
      dampen({
        object:mousePosition,
        prop:'x',
        value: x*window.devicePixelRatio,
        speed:1
      });
      dampen({
        object:mousePosition,
        prop:'y',
        value: window.innerHeight*window.devicePixelRatio - y*window.devicePixelRatio,
        speed:1
      });
    //    mousePosition.x = x*window.devicePixelRatio;
    //    mousePosition.y = window.innerHeight - y*window.devicePixelRatio;
    }

    this.pause = function() {
      pause=!pause;
      console.log('pause')
    }

    /**
     * Update Simulation
     */
    this.updateSimulation = function(){
        if(!pause) {time += 0.01*drops.time;}


        var resolutionScale = Math.min(window.innerWidth / (targetScreenSize != null ? targetScreenSize : 1920), 1.0);

        // Update positions and speeds

        var radius=drops.radius
        var count = config.metaballs.length;
        var centerX = displayWidth * .5;
        var centerY = displayHeight * .5;
        var targX, targY, t, d, mb;
        for (var i = 0; i < count; i++) {
            mb = metaballsObjects[i];
            //mb.x = centerX + (mb.centerOffsetX + ( Math.sin( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierX ) + ( Math.sin( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierX )) * animationProperties.positionMultiplier;
            //mb.y = centerY + (mb.centerOffsetY + ( Math.cos( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierY ) + ( Math.cos( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierY )) * animationProperties.positionMultiplier;
            //mb.targRadius = mb.radius + (( Math.cos( ( mb.t + time ) * mb.speed ) * 5 ) + ( Math.sin( ( mb.t + time ) * mb.speed ) * 5 )) * animationProperties.positionMultiplier;

            //mb.x = centerX + (mb.centerOffsetX * resolutionScale + ( Math.sin( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierX ) + ( Math.sin( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierX )) * animationProperties.positionMultiplier;
            //mb.y = centerY + (mb.centerOffsetY * resolutionScale + ( Math.cos( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierY ) + ( Math.cos( ( mb.t + time ) * mb.speed ) * radius * mb.arcMultiplierY )) * animationProperties.positionMultiplier;
            targX = centerX + (mb.centerOffsetX * resolutionScale + ( Math.sin(( mb.t + time ) * mb.speed) * radius * mb.arcMultiplierX ) + ( Math.sin(( mb.t + time ) * mb.speed) * radius * mb.arcMultiplierX )) * animationProperties.positionMultiplier;
            targY = centerY + (mb.centerOffsetY * resolutionScale + ( Math.cos(( mb.t + time ) * mb.speed) * radius * mb.arcMultiplierY ) + ( Math.cos(( mb.t + time ) * mb.speed) * radius * mb.arcMultiplierY )) * animationProperties.positionMultiplier;

            t = Math.atan2(mb.x - mousePosition.x, mb.y - mousePosition.y);
            d = 500 / Math.sqrt(Math.pow(mousePosition.x - mb.x, 2) + Math.pow(mousePosition.y - mb.y, 2));
            mb.x += d * Math.sin(t) + (targX - mb.x) * 0.1;
            mb.y += d * Math.cos(t) + (targY - mb.y) * 0.1;
        }

        // To send the data to the GPU, we first need to
        // flatten our data into a single array.
        //var dataToSendToGPU = new Float32Array(3 * count);
        let lastIndex;
        for (var i = 0; i < count; i++) {
            var baseIndex = 3 * i;
            var mb = metaballsObjects[i];
            dataToSendToGPU[baseIndex + 0] = mb.x;
            dataToSendToGPU[baseIndex + 1] = mb.y;
            dataToSendToGPU[baseIndex + 2] = (mb.radius * drops.radiusControl*animationProperties.radiusMultiplier) * resolutionScale;
            lastIndex=baseIndex;
            lastRadius=mb.radius
        }

        if(layerId == drops.cursorLayer-1) {
          dataToSendToGPU[lastIndex + 3] = mousePosition.x;
          dataToSendToGPU[lastIndex + 4] = mousePosition.y;
          dataToSendToGPU[baseIndex + 5] = (drops.radiusControl*lastRadius*animationProperties.radiusMultiplier) * resolutionScale;
          lastIndex=baseIndex;

        }
        else {
          dataToSendToGPU[lastIndex + 3] = 0;
          dataToSendToGPU[lastIndex + 4] = 0;
          dataToSendToGPU[baseIndex + 5] = 0;
        }


        gl.useProgram(program);
        gl.uniform1f(timeUniform, time);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);

        gl.enable(gl.BLEND);
        //gl.blendFunc(gl.ONE, gl.SRC_ALPHA);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform3fv(metaballsObjectsHandle, dataToSendToGPU);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    };

    initializeShader();
    setupSimulation();
    setupAttributes();
}
