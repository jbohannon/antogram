let antSprite;
let frameCount = 0;
const FRAME_WIDTH = 96;  // Width of each frame in the sprite sheet
const FRAME_HEIGHT = 101; // Height of each frame
const NUM_FRAMES = 4;    // Number of frames in the sprite sheet
const SCALE = 0.25;      // Scale factor for the ant (25% of original size)

// Ant movement properties
let antX = 200;          // Starting X position
let antY = 200;          // Starting Y position
let antSpeed = 2;        // Pixels per frame
let antDirection = 0;    // Angle in radians

// Animation properties
const PIXELS_PER_STEP = 8;  // How many pixels to move per animation cycle
let distanceTraveled = 0;   // Track distance for animation

function preload() {
    antSprite = loadImage('/static/images/ant_sprite_sheet.png');
}

function setup() {
    createCanvas(400, 400);
    frameRate(30);
}

function draw() {
    background(255);
    
    // Update ant position
    antX += cos(antDirection) * antSpeed;
    antY += sin(antDirection) * antSpeed;
    
    // Wrap around screen edges
    if (antX < 0) antX = width;
    if (antX > width) antX = 0;
    if (antY < 0) antY = height;
    if (antY > height) antY = 0;
    
    // Update distance traveled for animation
    distanceTraveled += antSpeed;
    
    // Draw the ant
    drawAnt(antX, antY, antDirection);
    
    // Change direction occasionally
    if (frameCount % 60 === 0) {  // Every 2 seconds at 30fps
        antDirection = random(TWO_PI);
    }
    
    frameCount++;
}

function drawAnt(x, y, angle) {
    push();
    translate(x, y);
    rotate(angle);
    
    // Calculate animation frame based on distance traveled
    // Each animation cycle (4 frames) covers PIXELS_PER_STEP distance
    let frameIndex = Math.floor((distanceTraveled % PIXELS_PER_STEP) / PIXELS_PER_STEP * NUM_FRAMES);
    
    // Calculate scaled dimensions
    let scaledWidth = FRAME_WIDTH * SCALE;
    let scaledHeight = FRAME_HEIGHT * SCALE;
    
    // Draw the sprite
    // Note: We use -scaledWidth to flip the sprite horizontally
    image(antSprite, 
          -scaledWidth/2, -scaledHeight/2,  // Position (centered)
          scaledWidth, scaledHeight,        // Display size
          frameIndex * FRAME_WIDTH, 0,      // Source x, y
          FRAME_WIDTH, FRAME_HEIGHT);       // Source width, height
    
    pop();
} 