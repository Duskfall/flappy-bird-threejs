// Scene, Camera, Renderer
let scene, camera, renderer;
let gameStarted = false;
let gameOver = false;
let score = 0;
let scoreElement;

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    // Make camera follow bird slightly for a more dynamic feel
    // camera.position.x = birdMesh.position.x + 2; 

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create Local Bird
    localBirdMesh = createBird(true); // Pass true for local player
    scene.add(localBirdMesh);
    localBirdMesh.position.x = -2; // Start bird a bit to the left

    // Create a dummy remote player bird
    const remoteBird = createBird(false); // Pass false for remote player
    remoteBird.position.x = -2.5; // Slightly different starting position
    remoteBird.position.y = 1;    // Different y
    remotePlayers["dummy_player_1"] = { mesh: remoteBird, velocityY: 0 }; // Store it
    scene.add(remoteBird);

    // Create Pipes
    pipes = [];
    const pipePair = createPipe();
    scene.add(pipePair.upper);
    scene.add(pipePair.lower);
    pipes.push(pipePair);

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Handle Input
    document.addEventListener('keydown', onInput, false);
    document.addEventListener('mousedown', onInput, false); // For mouse click

    // Initial message
    showStartMessage();
    createScoreDisplay();

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (!gameStarted || gameOver) {
        // Simple wing flap animation even when game not started or over
        const time = Date.now() * 0.01;
        if (localBirdMesh) { // Ensure localBirdMesh is defined
            localBirdMesh.children[0].rotation.z = Math.PI / 4 + Math.sin(time) * 0.3; // Left Wing
            localBirdMesh.children[1].rotation.z = -Math.PI / 4 - Math.sin(time) * 0.3; // Right Wing
        }
        renderer.render(scene, camera);
        return;
    }

    // Bird physics (for local player)
    birdVelocityY += gravity;
    localBirdMesh.position.y += birdVelocityY;

    // Simple wing flap animation (for local player)
    const time = Date.now() * 0.01;
    localBirdMesh.children[0].rotation.z = Math.PI / 4 + Math.sin(time) * 0.3; // Left Wing
    localBirdMesh.children[1].rotation.z = -Math.PI / 4 - Math.sin(time) * 0.3; // Right Wing

    // Animate remote players' wings
    Object.values(remotePlayers).forEach(player => {
        if (player.mesh) {
            const remoteTime = Date.now() * 0.008; // Slightly different speed for variety
            player.mesh.children[0].rotation.z = Math.PI / 4 + Math.sin(remoteTime) * 0.3;
            player.mesh.children[1].rotation.z = -Math.PI / 4 - Math.sin(remoteTime) * 0.3;
            // In a real multiplayer game, you'd update player.mesh.position based on network data
        }
    });

    // Move Pipes
    pipes.forEach(pipePair => {
        pipePair.upper.position.x -= pipeSpeed;
        pipePair.lower.position.x -= pipeSpeed;
    });

    // Remove pipes that are off-screen and add new ones
    if (pipes.length > 0 && pipes[0].upper.position.x < -camera.position.z - pipeWidth) { // -camera.position.z to be sure its off screen
        const oldPipePair = pipes.shift();
        scene.remove(oldPipePair.upper);
        scene.remove(oldPipePair.lower);

        const newPipePair = createPipe();
        newPipePair.upper.position.x = pipeSpawnX;
        newPipePair.lower.position.x = pipeSpawnX;
        scene.add(newPipePair.upper);
        scene.add(newPipePair.lower);
        pipes.push(newPipePair);
    }

    // Spawn initial pipes until the screen is full
    if (pipes.length > 0 && pipes[pipes.length -1].upper.position.x < pipeSpawnX - pipeSpacing) {
         if (pipes.length < maxPipes) {
            const newPipePair = createPipe();
            // Ensure new pipes are spawned correctly relative to the last one
            const lastPipeX = pipes[pipes.length - 1].upper.position.x;
            newPipePair.upper.position.x = lastPipeX + pipeSpacing;
            newPipePair.lower.position.x = lastPipeX + pipeSpacing;
            scene.add(newPipePair.upper);
            scene.add(newPipePair.lower);
            pipes.push(newPipePair);
        }
    }

    // Update Score
    updateScore();

    // Collision Detection
    checkCollisions();

    // Game logic and rendering will go here
    renderer.render(scene, camera);
}

// Bird
let localBirdMesh; // Renamed from birdMesh
let remotePlayers = {}; // To store remote players' birds

function createBird(isLocal = true) {
    const birdGeometry = new THREE.SphereGeometry(0.2, 32, 32); // Body
    const birdColor = isLocal ? 0xffff00 : 0x0000ff; // Yellow for local, Blue for remote
    const birdMaterial = new THREE.MeshPhongMaterial({ color: birdColor });
    const newBirdMesh = new THREE.Mesh(birdGeometry, birdMaterial);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.05);
    const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xffa500 }); // Orange for all wings

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.25, 0, 0.1);
    leftWing.rotation.z = Math.PI / 4;
    newBirdMesh.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.25, 0, 0.1);
    rightWing.rotation.z = -Math.PI / 4;
    newBirdMesh.add(rightWing);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 }); // Black

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 0.1, 0.15);
    newBirdMesh.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 0.1, 0.15);
    newBirdMesh.add(rightEye);

    newBirdMesh.position.y = 0.5; // Initial position

    // Lights are already added in init, no need to re-add for every bird if they are global
    // However, ensure they are added if not already
    if (!scene.getObjectByName("ambientLight")) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        ambientLight.name = "ambientLight";
        scene.add(ambientLight);
    }
    if (!scene.getObjectByName("pointLight")) {
        const pointLight = new THREE.PointLight(0xffffff, 0.8);
        pointLight.name = "pointLight";
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);
    }

    return newBirdMesh;
}

// Pipes
let pipes;
const pipeGap = 3.8; // Increased gap slightly
const pipeWidth = 0.8; // Made pipes a bit wider
const pipeHeight = 4; // Made pipes taller
const pipeTopWidth = 0.9;
const pipeTopHeight = 0.4;
const pipeSpeed = 0.035;
const pipeSpawnX = 7; // X position where new pipes spawn
const pipeSpacing = 4; // Spacing between pipe pairs
const maxPipes = 4; // Maximum number of pipe pairs on screen

function createPipe() {
    const pipeMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 }); // Green

    // Lower Pipe
    const lowerPipeGeometry = new THREE.CylinderGeometry(pipeWidth / 2, pipeWidth / 2, pipeHeight, 32);
    const lowerPipeMesh = new THREE.Mesh(lowerPipeGeometry, pipeMaterial);

    const lowerPipeTopGeometry = new THREE.CylinderGeometry(pipeTopWidth / 2, pipeTopWidth / 2, pipeTopHeight, 32);
    const lowerPipeTopMesh = new THREE.Mesh(lowerPipeTopGeometry, pipeMaterial);
    lowerPipeTopMesh.position.y = pipeHeight / 2 + pipeTopHeight / 2;
    lowerPipeMesh.add(lowerPipeTopMesh);

    // Upper Pipe
    const upperPipeGeometry = new THREE.CylinderGeometry(pipeWidth / 2, pipeWidth / 2, pipeHeight, 32);
    const upperPipeMesh = new THREE.Mesh(upperPipeGeometry, pipeMaterial);

    const upperPipeTopGeometry = new THREE.CylinderGeometry(pipeTopWidth / 2, pipeTopWidth / 2, pipeTopHeight, 32);
    const upperPipeTopMesh = new THREE.Mesh(upperPipeTopGeometry, pipeMaterial);
    upperPipeTopMesh.position.y = -pipeHeight / 2 - pipeTopHeight / 2;
    upperPipeMesh.add(upperPipeTopMesh);
    upperPipeMesh.rotation.x = Math.PI; // Rotate to face downwards

    // Position pipes
    const yOffset = (Math.random() - 0.5) * (pipeHeight - pipeGap - pipeTopHeight * 1.5); // Adjusted yOffset calculation
    lowerPipeMesh.position.set(pipeSpawnX, -pipeGap / 2 - pipeHeight / 2 + yOffset, 0);
    upperPipeMesh.position.set(pipeSpawnX, pipeGap / 2 + pipeHeight / 2 + yOffset, 0);

    return { upper: upperPipeMesh, lower: lowerPipeMesh, passed: false };
}

// Game Mechanics
const gravity = -0.005; // Adjusted gravity
const flapStrength = 0.10; // Adjusted flap strength
let birdVelocityY = 0;

function flap() {
    birdVelocityY = flapStrength;
}

function onInput(event) {
    // Filter for relevant events first
    if (event.type === 'keydown' && event.code !== 'Space') {
        return; 
    }
    // Ensure it's a left click (button 0) for mousedown events
    if (event.type === 'mousedown' && event.button !== 0) {
        return; 
    }

    if (!gameStarted) { // Game is not started yet (initial load)
        gameStarted = true;
        // gameOver is already false or will be set by resetGameCore
        hideStartMessage();
        resetGameCore(); // Resets elements, score, sets gameOver = false
        flap();
        return;
    }

    if (gameOver) { // Game was over, player wants to restart
        // gameStarted is currently true, gameOver is true.
        // We want to restart the game immediately.
        
        // hideStartMessage(); // Not needed, start message isn't visible here
        // gameOverMessage is removed by resetGameCore

        resetGameCore();    // Resets elements, score, and sets gameOver = false.
                            // gameStarted remains true (from before game over).
        // Now, gameStarted = true, gameOver = false.
        flap(); // Start the new game with a flap.
        return;
    }

    // If game is active and not over (gameStarted = true, gameOver = false)
    flap();
}

function checkCollisions() {
    const birdBox = new THREE.Box3().setFromObject(localBirdMesh);

    // Screen boundaries collision (top and bottom)
    if (localBirdMesh.position.y + 0.2 > camera.Screentop || localBirdMesh.position.y - 0.2 < camera.ScreenBottom ) { 
        // camera.Screentop and camera.ScreenBottom are not properties of camera.
        // We need to calculate the world coordinates of the top/bottom of the screen
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(matrix);
        
        // Get view height at bird's x position
        const distance = camera.position.z - localBirdMesh.position.z;
        const vFOV = camera.fov * Math.PI / 180;
        const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
        const screenTopY = visibleHeight / 2;
        const screenBottomY = -visibleHeight / 2;

        if (localBirdMesh.position.y + 0.2 > screenTopY || localBirdMesh.position.y - 0.2 < screenBottomY) {
             setGameOver();
             return;
        }
    }

    // Pipe collision
    for (const pipePair of pipes) {
        const upperPipeBox = new THREE.Box3().setFromObject(pipePair.upper);
        const lowerPipeBox = new THREE.Box3().setFromObject(pipePair.lower);

        if (birdBox.intersectsBox(upperPipeBox) || birdBox.intersectsBox(lowerPipeBox)) {
            setGameOver();
            return;
        }
    }
}

function setGameOver() {
    if (gameOver) return; // Don't trigger multiple times
    gameOver = true;
    console.log("Game Over! Final Score:", score);

    // Optionally hide remote players on game over for the local player
    Object.values(remotePlayers).forEach(player => {
        if (player.mesh) {
            // player.mesh.visible = false; // Example: hide them
        }
    });

    // Show game over message
    const messageElement = document.createElement('div');
    messageElement.id = 'gameOverMessage';
    messageElement.style.position = 'absolute';
    messageElement.style.top = '50%';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translate(-50%, -50%)';
    messageElement.style.color = 'red';
    messageElement.style.fontSize = '32px';
    messageElement.style.fontFamily = 'Arial, sans-serif';
    messageElement.style.textAlign = 'center';
    messageElement.innerHTML = 'Game Over!<br>Click or Press Space to Restart';
    document.body.appendChild(messageElement);
}

// Renamed from resetGame and modified
function resetGameCore() {
    console.log("Resetting game elements...");
    // Remove game over message
    const gameOverMessageElement = document.getElementById('gameOverMessage');
    if (gameOverMessageElement) {
        gameOverMessageElement.remove();
    }

    // Reset bird
    localBirdMesh.position.set(-2, 0.5, 0);
    birdVelocityY = 0;

    // Reset/hide remote players (or reposition them)
    Object.values(remotePlayers).forEach(player => {
        if (player.mesh) {
            player.mesh.position.set(-2.5, 1, 0); // Reset their position too
            player.velocityY = 0;
            player.mesh.visible = true; // Make sure they are visible on reset
        }
    });

    // Reset pipes
    pipes.forEach(pipePair => {
        scene.remove(pipePair.upper);
        scene.remove(pipePair.lower);
    });
    pipes = [];
    const initialPipePair = createPipe();
    scene.add(initialPipePair.upper);
    scene.add(initialPipePair.lower);
    pipes.push(initialPipePair);
    // Add a few more pipes to fill the screen initially
    for(let i = 1; i < maxPipes; i++){
        const newPipePair = createPipe();
        newPipePair.upper.position.x = pipes[pipes.length-1].upper.position.x + pipeSpacing;
        newPipePair.lower.position.x = pipes[pipes.length-1].lower.position.x + pipeSpacing;
        scene.add(newPipePair.upper);
        scene.add(newPipePair.lower);
        pipes.push(newPipePair);
    }

    // Reset score
    score = 0;
    if(scoreElement) scoreElement.innerHTML = 'Score: 0';

    gameOver = false; // Only set gameOver to false here
    // gameStarted is NOT managed here anymore
    // showStartMessage() is NOT called here anymore
}

function showStartMessage() {
    const messageElement = document.createElement('div');
    messageElement.id = 'startMessage';
    messageElement.style.position = 'absolute';
    messageElement.style.top = '40%';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translate(-50%, -50%)';
    messageElement.style.color = 'white';
    messageElement.style.fontSize = '24px';
    messageElement.style.fontFamily = 'Arial, sans-serif';
    messageElement.style.textAlign = 'center';
    messageElement.innerHTML = 'Press Space or Click to Start';
    document.body.appendChild(messageElement);
}

function hideStartMessage() {
    const messageElement = document.getElementById('startMessage');
    if (messageElement) {
        messageElement.remove();
    }
}

function createScoreDisplay() {
    scoreElement = document.createElement('div');
    scoreElement.id = 'score';
    scoreElement.style.position = 'absolute';
    scoreElement.style.top = '10px';
    scoreElement.style.left = '10px';
    scoreElement.style.color = 'white';
    scoreElement.style.fontSize = '24px';
    scoreElement.style.fontFamily = 'Arial, sans-serif';
    scoreElement.innerHTML = 'Score: 0';
    document.body.appendChild(scoreElement);
}

function updateScore() {
    if (gameOver || !gameStarted) return;

    pipes.forEach(pipePair => {
        // Check if bird has passed the pipe and it hasn't been scored yet
        if (!pipePair.passed && pipePair.upper.position.x + pipeWidth / 2 < localBirdMesh.position.x) {
            score++;
            pipePair.passed = true; // Mark as passed so we don't score it again
            scoreElement.innerHTML = `Score: ${score}`;
            console.log("Score:", score);
        }
    });
}

// Start the game
init(); 