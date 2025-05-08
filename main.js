// Scene, Camera, Renderer
let scene, camera, renderer;
let gameStarted = false;
let gameOver = false;
let score = 0;
let scoreElement;

// Material definitions (using Phong for consistency with existing lighting)
const yellowMat = new THREE.MeshPhongMaterial({color: 0xFFCC00});
const orangeMat = new THREE.MeshPhongMaterial({color:0xF58216});
const lightGreenMat = new THREE.MeshPhongMaterial({color: 0xA0FFA0}); // For pipe body
const darkGreenMat = new THREE.MeshPhongMaterial({color: 0x20BB20});  // For pipe caps
const blackMat = new THREE.MeshPhongMaterial({color: 0x111111}); // For pupils and pipe openings
const whiteMat = new THREE.MeshPhongMaterial({color: 0xFFFFFF});   // For eyes

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
    localBirdMesh = createBird();
    scene.add(localBirdMesh);
    localBirdMesh.position.x = -2; // Start bird a bit to the left

    // Create a dummy remote player bird
    const remoteBird = createBird(); // Pass false for remote player
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
        const time = Date.now() * 0.01;
        if (localBirdMesh) {
            const lWing = localBirdMesh.getObjectByName("leftWing");
            const rWing = localBirdMesh.getObjectByName("rightWing");
            if (lWing && rWing) {
                lWing.rotation.z = Math.PI / 4 + Math.sin(time) * 0.5; 
                rWing.rotation.z = -Math.PI / 4 - Math.sin(time) * 0.5;
            }
        }
        renderer.render(scene, camera);
        return;
    }

    // Bird physics (for local player)
    birdVelocityY += gravity;
    localBirdMesh.position.y += birdVelocityY;

    // Simple wing flap animation (for local player)
    const time = Date.now() * 0.02; // Faster flap for active game
    if (localBirdMesh) {
        const lWing = localBirdMesh.getObjectByName("leftWing");
        const rWing = localBirdMesh.getObjectByName("rightWing");
        if (lWing && rWing) {
            lWing.rotation.z = Math.PI / 4 + Math.sin(time) * 0.7; 
            rWing.rotation.z = -Math.PI / 4 - Math.sin(time) * 0.7;
        }
    }

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
let localBirdMesh; // This will be a THREE.Group
let remotePlayers = {}; // Multiplayer temporarily removed in previous steps, ensure it is still out

function createBird() {
    localBirdMesh = new THREE.Group(); // Changed from Mesh to Group

    const bodyRadius = 0.2;
    // Body
    const birdBodyGeometry = new THREE.SphereGeometry(bodyRadius, 16, 16); // Fewer segments for performance
    const birdBody = new THREE.Mesh(birdBodyGeometry, yellowMat);
    localBirdMesh.add(birdBody);

    // Beak
    const beakGeometry = new THREE.ConeGeometry(0.05, 0.15, 8);
    const beak = new THREE.Mesh(beakGeometry, orangeMat);
    beak.position.set(0, 0, bodyRadius + 0.05); // Positioned at the front of the body
    beak.rotation.x = Math.PI / 2; // Pointing forwards
    localBirdMesh.add(beak);

    // Eyes
    const eyeRadius = 0.05;
    const pupilRadius = 0.025;
    for (let i = -1; i <= 1; i += 2) { // For left and right eyes
        const eyeGroup = new THREE.Group();
        const eyeScleraGeometry = new THREE.SphereGeometry(eyeRadius, 8, 8);
        const eyeSclera = new THREE.Mesh(eyeScleraGeometry, whiteMat);
        eyeGroup.add(eyeSclera);

        const pupilGeometry = new THREE.SphereGeometry(pupilRadius, 8, 8);
        const pupil = new THREE.Mesh(pupilGeometry, blackMat);
        pupil.position.z = eyeRadius * 0.6; // Slightly forward on the sclera
        eyeSclera.add(pupil);

        eyeGroup.position.set(i * bodyRadius * 0.6, bodyRadius * 0.3, bodyRadius * 0.7);
        localBirdMesh.add(eyeGroup);
    }

    // Wings
    const wingWidth = 0.08;
    const wingHeight = bodyRadius * 1.8;
    const wingDepth = bodyRadius * 0.8;
    const wingGeometry = new THREE.BoxGeometry(wingWidth, wingHeight, wingDepth);
    // const wingMaterial = orangeMat.clone(); // Using a slightly different color for wings
    // wingMaterial.color.setHex(0xFAA500);

    const leftWing = new THREE.Mesh(wingGeometry, orangeMat); // Using orangeMat for wings
    leftWing.name = "leftWing";
    leftWing.position.set(-bodyRadius * 0.8, 0, -wingDepth * 0.2);
    leftWing.rotation.y = Math.PI / 12;
    leftWing.rotation.z = Math.PI / 4; // Initial angle
    localBirdMesh.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, orangeMat);
    rightWing.name = "rightWing";
    rightWing.position.set(bodyRadius * 0.8, 0, -wingDepth * 0.2);
    rightWing.rotation.y = -Math.PI / 12;
    rightWing.rotation.z = -Math.PI / 4; // Initial angle
    localBirdMesh.add(rightWing);

    // Add existing lights if they were removed by previous rejected changes
    // This assumes lights are global to the scene and added in init()
    // Ensure ambient and point lights are in the scene (they should be from original setup)
    if (!scene.getObjectByName("ambientLightGlobal")) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        ambientLight.name = "ambientLightGlobal";
        scene.add(ambientLight);
    }
    if (!scene.getObjectByName("pointLightGlobal")) {
        const pointLight = new THREE.PointLight(0xffffff, 0.8, 100);
        pointLight.name = "pointLightGlobal";
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);
    }

    // localBirdMesh will be positioned by the game logic (e.g., in resetGameCore)
    return localBirdMesh; // Return the group
}

// Pipes
let pipes;
// Existing pipe dimension constants - these will primarily define gameplay space
const pipeGap = 3.8; // Gap between upper and lower pipes
const pipeWidth = 0.8; // Overall width for collision and bird passage
const pipeHeight = 4; // Max height of one side of the pipe structure for gameplay
const pipeTopWidth = 0.9; // Width of the cap, slightly wider than body
const pipeTopHeight = 0.4; // Height of the cap

const pipeSpeed = 0.035; // Ensure this matches user's last adjustment if any
const pipeSpawnX = 7; 
const pipeSpacing = 4; 
const maxPipes = 4; 

function createPipe() {
    const pipePair = { upper: new THREE.Group(), lower: new THREE.Group(), passed: false };

    // Define dimensions for the visual parts based on gameplay constants
    const shaftRadius = pipeWidth / 2;
    const shaftHeight = pipeHeight; // Main visible part of the pipe shaft

    const capRadius = pipeTopWidth / 2;
    const capHeight = pipeTopHeight;

    const openingRadius = shaftRadius * 0.8; // For the black inner part

    // Lower Pipe Assembly
    const lowerShaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 16, 1);
    const lowerShaftMesh = new THREE.Mesh(lowerShaftGeom, lightGreenMat);
    // lowerShaftMesh.position.y = shaftHeight / 2; // Origin at center, so position relative to group
    pipePair.lower.add(lowerShaftMesh);

    const lowerCapGeom = new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 16, 1);
    const lowerCapMesh = new THREE.Mesh(lowerCapGeom, darkGreenMat);
    lowerCapMesh.position.y = shaftHeight / 2 + capHeight / 2; // Position cap on top of shaft
    pipePair.lower.add(lowerCapMesh);

    const lowerOpeningGeom = new THREE.CylinderGeometry(openingRadius, openingRadius, capHeight * 1.1, 16, 1); // Slightly taller to ensure visibility
    const lowerOpeningMesh = new THREE.Mesh(lowerOpeningGeom, blackMat);
    lowerOpeningMesh.position.y = shaftHeight / 2 + capHeight / 2; // Same position as cap
    pipePair.lower.add(lowerOpeningMesh);

    // Upper Pipe Assembly (similar, but rotated)
    const upperShaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 16, 1);
    const upperShaftMesh = new THREE.Mesh(upperShaftGeom, lightGreenMat);
    // upperShaftMesh.position.y = -shaftHeight / 2;
    pipePair.upper.add(upperShaftMesh);

    const upperCapGeom = new THREE.CylinderGeometry(capRadius, capRadius, capHeight, 16, 1);
    const upperCapMesh = new THREE.Mesh(upperCapGeom, darkGreenMat);
    upperCapMesh.position.y = -(shaftHeight / 2 + capHeight / 2); // Position cap below shaft (for upper pipe)
    pipePair.upper.add(upperCapMesh);

    const upperOpeningGeom = new THREE.CylinderGeometry(openingRadius, openingRadius, capHeight * 1.1, 16, 1);
    const upperOpeningMesh = new THREE.Mesh(upperOpeningGeom, blackMat);
    upperOpeningMesh.position.y = -(shaftHeight / 2 + capHeight / 2);
    pipePair.upper.add(upperOpeningMesh);

    // Position the pipe groups (upper and lower assemblies)
    // The yOffset calculation is based on the total height of one pipe assembly (shaft + cap)
    const totalVisualPipeHeight = shaftHeight + capHeight; 
    // yOffset determines the vertical position of the center of the gap
    // The random range should allow the gap to shift, but ensure pipes are connected to top/bottom conceptually
    const yOffsetRange = shaftHeight * 0.6; // Allow gap to move by a portion of shaft height
    const yOffset = (Math.random() - 0.5) * yOffsetRange;

    pipePair.lower.position.set(pipeSpawnX, -pipeGap / 2 - totalVisualPipeHeight / 2 + yOffset, 0);
    pipePair.upper.position.set(pipeSpawnX, pipeGap / 2 + totalVisualPipeHeight / 2 + yOffset, 0);
    
    // The actual meshes (like upperShaftMesh) are positioned at (0,0,0) relative to their parent group (pipePair.upper/lower)
    // The parent groups (pipePair.upper/lower) are then positioned in the world.

    return pipePair;
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
    const birdBodyRadius = 0.2; // Radius of the bird's spherical body

    // Screen boundaries collision (top and bottom)
    // We need to calculate the world coordinates of the top/bottom of the screen dynamically
    const distance = camera.position.z - localBirdMesh.position.z; // localBirdMesh.position.z is 0
    const vFOV = camera.fov * Math.PI / 180; // Convert fov to radians
    const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
    const screenTopY = visibleHeight / 2;
    const screenBottomY = -visibleHeight / 2;

    // Condition for the *whole bird* being out of the viewport:
    // 1. Bird's bottom edge is above the screen's top edge OR
    // 2. Bird's top edge is below the screen's bottom edge
    if ((localBirdMesh.position.y - birdBodyRadius > screenTopY) || 
        (localBirdMesh.position.y + birdBodyRadius < screenBottomY)) {
         setGameOver();
         return;
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