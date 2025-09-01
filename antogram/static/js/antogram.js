// Mobile performance optimization
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
const RENDER_SCALE = IS_MOBILE ? 0.75 : 1;  // Render at 75% resolution on mobile

// Configuration variables
let mode = "text";
let message = "";
let imageData = "";

// Reverse mode configuration
let isReverseMode = false;
let isLandingPage = false;

// Add p5.js text style constant
const BOLD = 'bold';

// Global arrays for bits (the pixels) and ants
let bits = [];
let ants = [];
let targetPositions = [];
let img;       // for image mode
let offscreen; // offscreen graphics for drawing text/image

// Add these constants at the top with other constants
const MAX_NEAREST_CHECKS = 30;   // tune for quality vs. speed especially on Android
const ANT_FRAME_WIDTH = 96;
const ANT_FRAME_HEIGHT = 101;
const ANT_NUM_FRAMES = 4;
const ANT_SCALE = 0.25;
const ANT_PIXELS_PER_STEP = 8;

// Function to update URL with encoded ID
function updateURL(encodedId) {
    window.location.href = `/?id=${encodedId}`;
}

// UI Control functions
function showCreationControls() {
    document.getElementById('creationControls').style.display = 'flex';
    document.getElementById('viewControls').style.display = 'none';
    document.querySelector('.banner-right').style.display = 'none';
}

function showViewControls() {
    document.getElementById('creationControls').style.display = 'none';
    document.getElementById('viewControls').style.display = 'flex';
    document.querySelector('.banner-right').style.display = 'flex';
}

function switchToViewMode() {
    document.getElementById('creationControls').style.display = 'none';
    document.getElementById('viewControls').style.display = 'flex';
    document.getElementById('creationAttribution').style.display = 'none';
    document.getElementById('viewShareSection').style.display = 'flex';
}

function switchToCreationMode() {
    document.getElementById('creationControls').style.display = 'flex';
    document.getElementById('viewControls').style.display = 'none';
    document.getElementById('creationAttribution').style.display = 'block';
    document.getElementById('viewShareSection').style.display = 'none';
}

// Function to handle form submission
function handleSubmit() {
    const input = document.getElementById('textInput').value.trim();
    
    if (!input) {
        alert('Please enter a message or image URL');
        return;
    }
    
    // Determine if input is a URL (starts with https://) or text
    const isImageUrl = input.startsWith('https://');
    
    if (isImageUrl) {
        // Handle as image URL
        if (input.length > 2000) {
            alert('Image URL exceeds 2000 characters');
            return;
        }
        
        mode = 'image';
        imageData = input;
        
        // Clear existing arrays
        bits = [];
        ants = [];
        targetPositions = [];
        
        // Prepare image before sending to server
        prepareImage();
        
        fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'image',
                content: input
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.encoded_id) {
                showViewControls();
                updateURL(data.encoded_id);
            }
        });
    } else {
        // Handle as text message
        if (input.length > 200) {
            alert('Text message exceeds 200 characters');
            return;
        }
        
        mode = 'text';
        message = input;
        
        // Clear existing arrays
        bits = [];
        ants = [];
        targetPositions = [];
        
        // Prepare text before sending to server
        prepareText();
        
        fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'text',
                content: message
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.encoded_id) {
                showViewControls();
                updateURL(data.encoded_id);
            }
        });
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Generate button
    document.getElementById('generateBtn').addEventListener('click', handleSubmit);
    
    // Form inputs
    document.getElementById('textInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    });

    // Create new button
    document.getElementById('createNewBtn').addEventListener('click', () => {
        window.location.href = '/';
    });

    // Share buttons
    document.getElementById('emailBtn').addEventListener('click', () => {
        const url = window.location.href;
        const subject = 'Check out this antogram!';
        const body = `I created an antogram! View it here: ${url}`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    document.getElementById('twitterBtn').addEventListener('click', () => {
        const url = window.location.href;
        const text = 'Check out this antogram I created!';
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    });

    document.getElementById('instagramBtn').addEventListener('click', () => {
        alert('To share on Instagram, copy the link and paste it in your Instagram story or post!');
    });

    document.getElementById('facebookBtn').addEventListener('click', () => {
        const url = window.location.href;
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    });
});

// Function to generate random scattered target positions for reverse mode
function generateRandomTargets(numTargets) {
    targetPositions = []; // Clear existing targets
    
    // Generate well-distributed random positions
    for (let i = 0; i < numTargets; i++) {
        let attempts = 0;
        let newPos;
        
        do {
            newPos = createVector(
                random(50, width - 50),   // Avoid edges
                random(50, height - 50)
            );
            attempts++;
        } while (attempts < 10 && isTooCloseToExisting(newPos, 30));
        
        targetPositions.push(newPos);
    }
}

// Helper function to check if a position is too close to existing targets
function isTooCloseToExisting(pos, minDistance) {
    for (let target of targetPositions) {
        if (p5.Vector.dist(pos, target) < minDistance) {
            return true;
        }
    }
    return false;
}

// Function to prepare landing page with "Write with ants" message
function prepareLandingPage() {
    message = "Write with ants";
    mode = "text";
    isReverseMode = true;
    isLandingPage = true;
    
    // Prepare the text and positions
    prepareText();
}

// Bit class: holds the current scattered position and target position
class Bit {
  constructor(x, y, col, targetX = null, targetY = null) {
    // Position logic based on mode
    if (isReverseMode) {
      // In reverse mode: bits start at letter positions with small random perturbations
      this.pos = createVector(
        x + random(-2, 2),  // Add same randomness as final delivery positions
        y + random(-2, 2)
      );
    } else {
      // In normal mode: bits start at random positions
      this.pos = createVector(random(width), random(height));
    }
    
    this.col = col;
    this.carried = false;
    this.delivered = false;
    // Store original target position for images
    this.targetX = targetX;
    this.targetY = targetY;
    // Add pickup animation properties
    this.pickupProgress = 0;
    this.pickupStartPos = null;
    this.pickupTargetPos = null;
  }

  // Add method to start pickup animation
  startPickup(antPos, antHeading) {
    this.pickupStartPos = this.pos.copy();
    // Calculate target position at ant's jaws
    let bitOffset = p5.Vector.fromAngle(antHeading);
    bitOffset.mult(ANT_FRAME_WIDTH * ANT_SCALE * 0.6);  // 60% of ant's width from center
    this.pickupTargetPos = p5.Vector.add(antPos, bitOffset);
    this.pickupProgress = 0;
  }

  // Add method to update pickup animation
  updatePickup() {
    if (this.pickupProgress < 1) {
      this.pickupProgress += 0.1; // Adjust speed of pickup animation
      // Use smooth easing function for natural movement
      let easedProgress = this.pickupProgress * this.pickupProgress * (3 - 2 * this.pickupProgress);
      this.pos = p5.Vector.lerp(this.pickupStartPos, this.pickupTargetPos, easedProgress);
    }
  }
}

// Ant class: each ant will seek an available bit and carry it to a target position
class Ant {
    constructor() {
        this.pos = createVector(random(width), random(height));
        this.velocity = p5.Vector.random2D().mult(2);
        this.maxSpeed = IS_MOBILE ? 4.5 : 3;  // 50% faster on mobile
        this.wanderStrength = 0.5;
        this.carrying = null;
        this.targetPos = null;
        this.distanceTraveled = 0;
        
        // Wandering behavior properties
        this.wanderTarget = null;     // Current wander target
        this.wanderDistance = 0;      // Distance traveled in current wander
        this.bodyLength = ANT_FRAME_WIDTH * ANT_SCALE; // Ant's body length
        this.maxWanderDistance = random(5, 10) * this.bodyLength; // 5-10 body lengths
        
        // Separation behavior properties
        this.separationRadius = this.bodyLength * 2; // Distance at which ants start avoiding each other
        this.separationStrength = 0.5; // Strength of the separation force
    }

    update() {
        if (this.carrying == null) {
            // Find the nearest uncarried bit using center position
            let nearest = null;
            let minD2   = Infinity;
            let checked = 0;
            
            for (let i = 0; i < bits.length && checked < MAX_NEAREST_CHECKS; i++) {
              const b = bits[i];
              if (b.carried || b.delivered) continue;
            
              const dx = b.pos.x - this.pos.x;
              const dy = b.pos.y - this.pos.y;
              const d2 = dx*dx + dy*dy;      // avoiding sqrt calc
            
              if (d2 < minD2) {
                minD2   = d2;
                nearest = b;
              }
              checked++;
            }            
            
            if (nearest) {
                // Calculate desired direction
                let desired = p5.Vector.sub(nearest.pos, this.pos);
                let distanceToTarget = desired.mag();
                desired.setMag(this.maxSpeed);
                
                // Add subtle distance-based orientation randomness
                let maxRandomAngle = map(distanceToTarget, 0, 200, 0, PI/16);
                let randomAngle = random(-maxRandomAngle, maxRandomAngle);
                desired.rotate(randomAngle);
                
                let wander = p5.Vector.random2D();
                wander.mult(this.wanderStrength);
                desired.add(wander);
                
                // Add separation force
                let separation = this.calculateSeparation();
                desired.add(separation);
                
                // Limit the steering force more aggressively when changing direction
                let steer = p5.Vector.sub(desired, this.velocity);
                let currentSpeed = this.velocity.mag();
                let steerLimit = map(currentSpeed, 0, this.maxSpeed, 0.1, 0.3);
                steer.limit(steerLimit);
                this.velocity.add(steer);
                
                // Ensure minimum velocity to prevent spinning
                if (this.velocity.mag() < 0.5) {
                    this.velocity.setMag(0.5);
                }
                
                this.velocity.limit(this.maxSpeed);
                this.pos.add(this.velocity);
                
                // Check distance from center to bit for pickup
                if (p5.Vector.dist(this.pos, nearest.pos) < 5) {
                    this.carrying = nearest;
                    nearest.carried = true;
                    // Start pickup animation
                    nearest.startPickup(this.pos, this.velocity.heading());
                    
                    // For images, use the bit's stored target position
                    if (mode === "image" && nearest.targetX !== null && nearest.targetY !== null) {
                        this.targetPos = createVector(nearest.targetX, nearest.targetY);
                    } else {
                        // For text, find target position (with or without bias based on mode)
                        if (targetPositions.length > 0) {
                            let bestTarget = null;
                            let bestScore = Infinity;
                            
                            for (let i = 0; i < targetPositions.length; i++) {
                                let target = targetPositions[i];
                                let d = p5.Vector.dist(this.pos, target);
                                let score = d;
                                
                                // Add top-left bias only in normal mode (not in reverse mode)
                                if (!isReverseMode) {
                                    let topLeftBias = (target.x / width + target.y / height) * width * 0.5;
                                    score += topLeftBias;
                                }
                                
                                if (score < bestScore) {
                                    bestScore = score;
                                    bestTarget = i;
                                }
                            }
                            
                            // Assign the chosen target
                            this.targetPos = targetPositions[bestTarget];
                            // Remove the target position from available positions
                            targetPositions.splice(bestTarget, 1);
                        }
                    }
                }
            } else {
                // Wandering behavior when no bits are available
                // If we don't have a wander target or reached it, choose a new one
                if (!this.wanderTarget || this.wanderDistance >= this.maxWanderDistance) {
                    // Get current heading
                    let currentHeading = this.velocity.heading();
                    // Generate a random angle within +/- 45 degrees of current heading (reduced from 90)
                    let angleOffset = random(-PI/4, PI/4);
                    let newHeading = currentHeading + angleOffset;
                    
                    // Create new wander target with limited angle change
                    this.wanderTarget = p5.Vector.fromAngle(newHeading)
                        .mult(this.maxWanderDistance)
                        .add(this.pos);
                    
                    this.wanderDistance = 0;
                    this.maxWanderDistance = random(5, 10) * this.bodyLength; // New random wander distance
                }
                
                // Move toward wander target
                let desired = p5.Vector.sub(this.wanderTarget, this.pos);
                desired.setMag(this.maxSpeed);
                
                // Add separation force
                let separation = this.calculateSeparation();
                desired.add(separation);
                
                // Limit the steering force more aggressively when changing direction
                let steer = p5.Vector.sub(desired, this.velocity);
                let currentSpeed = this.velocity.mag();
                let steerLimit = map(currentSpeed, 0, this.maxSpeed, 0.1, 0.3);
                steer.limit(steerLimit);
                this.velocity.add(steer);
                
                // Ensure minimum velocity to prevent spinning
                if (this.velocity.mag() < 0.5) {
                    this.velocity.setMag(0.5);
                }
                
                this.velocity.limit(this.maxSpeed);
                this.pos.add(this.velocity);
                
                // Update distance traveled in current wander
                this.wanderDistance += this.velocity.mag();
                
                // If we hit a wall, choose a new direction away from the wall
                if (this.pos.x <= 0 || this.pos.x >= width || this.pos.y <= 0 || this.pos.y >= height) {
                    // Determine which wall was hit and choose a new direction away from it
                    let newHeading;
                    if (this.pos.x <= 0) {
                        // Hit left wall - move right with some randomness
                        newHeading = random(-PI/4, PI/4);
                    } else if (this.pos.x >= width) {
                        // Hit right wall - move left with some randomness
                        newHeading = random(PI*3/4, PI*5/4);
                    } else if (this.pos.y <= 0) {
                        // Hit top wall - move down with some randomness
                        newHeading = random(PI/4, PI*3/4);
                    } else {
                        // Hit bottom wall - move up with some randomness
                        newHeading = random(-PI*3/4, -PI/4);
                    }
                    
                    // Create new velocity with the new heading
                    this.velocity = p5.Vector.fromAngle(newHeading).mult(this.maxSpeed);
                    
                    // Create new wander target in the new direction
                    this.wanderTarget = p5.Vector.fromAngle(newHeading)
                        .mult(this.maxWanderDistance)
                        .add(this.pos);
                    this.wanderDistance = 0;
                }
            }
        } else {
            // Carrying a bit: move it toward the chosen target location
            let desired = p5.Vector.sub(this.targetPos, this.pos);
            let distanceToTarget = desired.mag();
            desired.setMag(this.maxSpeed);
            
            // Add subtle distance-based orientation randomness
            let maxRandomAngle = map(distanceToTarget, 0, 200, 0, PI/16);
            let randomAngle = random(-maxRandomAngle, maxRandomAngle);
            desired.rotate(randomAngle);
            
            let wander = p5.Vector.random2D();
            wander.mult(this.wanderStrength * 0.3);
            desired.add(wander);
            
            let steer = p5.Vector.sub(desired, this.velocity);
            steer.limit(0.3);
            this.velocity.add(steer);
            this.velocity.limit(this.maxSpeed);
            this.pos.add(this.velocity);
            
            // Update bit position based on pickup animation or normal carrying
            if (this.carrying.pickupProgress < 1) {
                this.carrying.updatePickup();
            } else {
                // Normal carrying position
                let bitOffset = p5.Vector.fromAngle(this.velocity.heading());
                bitOffset.mult(ANT_FRAME_WIDTH * ANT_SCALE * 0.6);
                this.carrying.pos.x = this.pos.x + bitOffset.x;
                this.carrying.pos.y = this.pos.y + bitOffset.y;
            }
            
            if (p5.Vector.dist(this.pos, this.targetPos) < 5) {
                // Double the noise in final placement
                this.carrying.pos.x = this.targetPos.x + random(-2, 2);
                this.carrying.pos.y = this.targetPos.y + random(-2, 2);
                this.carrying.delivered = true;
                this.carrying.carried = false;
                this.carrying = null;
                this.targetPos = null;
            }
        }
        
        // Keep ants within canvas bounds
        this.pos.x = constrain(this.pos.x, 0, width);
        this.pos.y = constrain(this.pos.y, 0, height);
        
        // Update distance for animation
        this.distanceTraveled += this.velocity.mag();
    }

    // Calculate separation force from nearby ants
    calculateSeparation() {
        let separation = createVector(0, 0);
        let count = 0;
        
        for (let other of ants) {
            if (other === this) continue; // Skip self
            
            let d = p5.Vector.dist(this.pos, other.pos);
            if (d < this.separationRadius) {
                // Calculate vector pointing away from the other ant
                let diff = p5.Vector.sub(this.pos, other.pos);
                diff.normalize();
                diff.div(d); // Weight by distance (closer ants have stronger effect)
                separation.add(diff);
                count++;
            }
        }
        
        if (count > 0) {
            separation.div(count);
            separation.setMag(this.maxSpeed);
            separation.mult(this.separationStrength);
        }
        
        return separation;
    }

    draw() {
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.velocity.heading());
        
        // Calculate animation frame based on distance traveled
        let frameIndex = Math.floor((this.distanceTraveled % ANT_PIXELS_PER_STEP) / ANT_PIXELS_PER_STEP * ANT_NUM_FRAMES);
        
        // Calculate scaled dimensions
        let scaledWidth = ANT_FRAME_WIDTH * ANT_SCALE;
        let scaledHeight = ANT_FRAME_HEIGHT * ANT_SCALE;
        
        // Draw the sprite
        image(antSprite, 
              -scaledWidth/2, -scaledHeight/2,  // Position (centered)
              scaledWidth, scaledHeight,        // Display size
              frameIndex * ANT_FRAME_WIDTH, 0,  // Source x, y
              ANT_FRAME_WIDTH, ANT_FRAME_HEIGHT); // Source width, height
        
        pop();
    }
}

// Add antSprite variable at the top with other global variables
let antSprite;

function setup() {
    const sketchHolder = document.getElementById('sketch-holder');
    
    // Use scaled resolution for mobile performance
    const w = Math.floor(sketchHolder.clientWidth * RENDER_SCALE);
    const h = Math.floor(sketchHolder.clientHeight * RENDER_SCALE);
    const canvas = createCanvas(w, h);
    canvas.parent('sketch-holder');

    // Performance optimizations for mobile
    if (IS_MOBILE) {
        pixelDensity(1);   // Disable high-DPI rendering
        noSmooth();        // Disable anti-aliasing
        
        // Scale canvas up to full size with CSS
        const c = document.querySelector('canvas');
        c.style.width = `${sketchHolder.clientWidth}px`;
        c.style.height = `${sketchHolder.clientHeight}px`;
        
        frameRate(20);     // Lower frame rate
    } else {
        frameRate(30);     // Normal frame rate for desktop
    }
    
    offscreen = createGraphics(width, height);
    
    // Load the ant sprite
    antSprite = loadImage('/static/images/ant_sprite_sheet.png');
    
    // Clear existing arrays
    bits = [];
    ants = [];
    targetPositions = [];
    
    // Check for encoded ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const encodedId = urlParams.get('id');
    
    // Landing page detection: no encoded ID and no form inputs
    if (!encodedId) {
        const textInput = document.getElementById('textInput');
        const imageUrl = document.getElementById('imageUrl');
        
        // Check if this is a fresh landing page (no user input)
        if ((!textInput || !textInput.value) && (!imageUrl || !imageUrl.value)) {
            isLandingPage = true;
            // Initialize landing page with reverse mode
            prepareLandingPage();
            
            // Hide creation controls initially for landing page
            document.getElementById('creationControls').style.display = 'none';
            
            // Show controls after a delay to let the animation play
            setTimeout(() => {
                document.getElementById('creationControls').style.display = 'flex';
            }, 3000); // Show controls after 3 seconds
        }
    }
    
    if (encodedId) {
        // We're viewing an existing antogram
        document.getElementById('creationControls').style.display = 'none';
        document.getElementById('viewControls').style.display = 'flex';
        document.getElementById('creationAttribution').style.display = 'none';
        document.getElementById('viewShareSection').style.display = 'flex';
        
        // Fetch the content from the server
        fetch(`/generate?id=${encodedId}`, {
            method: 'GET'
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (data.type === 'text') {
                mode = "text";
                message = data.content;
                prepareText();
            } else if (data.type === 'image') {
                mode = "image";
                imageData = data.content;
                prepareImage();
            }
        })
        .catch(error => {
            console.error("Error:", error);
            alert("Error loading content: " + error.message);
        });
    } else {
        // We're on the creation page
        document.getElementById('creationControls').style.display = 'flex';
        document.getElementById('viewControls').style.display = 'none';
        document.getElementById('creationAttribution').style.display = 'block';
        document.getElementById('viewShareSection').style.display = 'none';
    }
    
    // Create ants with mobile optimization
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    let numAnts = isMobileDevice ? 100 : 200;  // Use 100 ants for mobile, 200 for desktop
    for (let i = 0; i < numAnts; i++) {
        ants.push(new Ant());
    }
}

// Add window resize handler
function windowResized() {
    const sketchHolder = document.getElementById('sketch-holder');
    const w = Math.floor(sketchHolder.clientWidth * RENDER_SCALE);
    const h = Math.floor(sketchHolder.clientHeight * RENDER_SCALE);
    resizeCanvas(w, h, true);
    
    if (IS_MOBILE) {
        const c = document.querySelector('canvas');
        c.style.width = `${sketchHolder.clientWidth}px`;
        c.style.height = `${sketchHolder.clientHeight}px`;
    }
    
    offscreen = createGraphics(width, height);
}

function prepareText() {
    offscreen.pixelDensity(1);
    offscreen.background(255);
    offscreen.fill(0);
    
    // Set initial text size
    let textSize = 120;
    offscreen.textSize(textSize);
    offscreen.textStyle(BOLD);
    offscreen.strokeWeight(2);
    offscreen.stroke(0);
    offscreen.textAlign(CENTER, CENTER);
    
    // Function to wrap text into lines
    function wrapText(text, maxWidth) {
        let words = text.split(' ');
        let lines = [];
        let currentLine = words[0];
        
        for (let i = 1; i < words.length; i++) {
            let word = words[i];
            let width = offscreen.textWidth(currentLine + ' ' + word);
            if (width < maxWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }
    
    // Calculate maximum width for text (with margins)
    let maxWidth = width * 0.9;
    
    // Wrap the text into lines
    let lines = wrapText(message, maxWidth);
    let lineHeight = textSize * 1.2;
    let totalHeight = lines.length * lineHeight;
    
    // If the wrapped text is too tall, reduce text size
    while (totalHeight > height * 0.9 && textSize > 20) {
        textSize -= 2;
        offscreen.textSize(textSize);
        lineHeight = textSize * 1.2;
        lines = wrapText(message, maxWidth);
        totalHeight = lines.length * lineHeight;
    }
    
    // Calculate starting y position to center the text vertically
    let startY = (height - totalHeight) / 2 + lineHeight / 2;
    
    // Draw each line of text
    for (let i = 0; i < lines.length; i++) {
        offscreen.text(lines[i], width/2, startY + i * lineHeight);
    }
    
    offscreen.loadPixels();
    
    // Decrease step size to double density
    let step = 4; // Changed from 8 to 4
    for (let x = 0; x < offscreen.width; x += step) {
        for (let y = 0; y < offscreen.height; y += step) {
            let index = 4 * (x + y * offscreen.width);
            let r = offscreen.pixels[index];
            let g = offscreen.pixels[index+1];
            let b = offscreen.pixels[index+2];
            let a = offscreen.pixels[index+3];
            
            if (a > 128 && r < 200) {
                // Generate a random soil-like color using RGB
                // Base brown color with random variations
                let baseR = 85;  // Base reddish-brown
                let baseG = 38;  // Base green component
                let baseB = 38;  // Base blue component
                
                // Add random variations to each component (increased ranges)
                let rVariation = random(-40, 40);  // Increased from ±20
                let gVariation = random(-30, 30);  // Increased from ±10
                let bVariation = random(-30, 30);  // Increased from ±10
                
                let soilColor = color(
                    constrain(baseR + rVariation, 0, 255),
                    constrain(baseG + gVariation, 0, 255),
                    constrain(baseB + bVariation, 0, 255)
                );
                
                if (isReverseMode) {
                    // In reverse mode: bits start at letter positions (x, y)
                    // and targets are random positions
                    bits.push(new Bit(x, y, soilColor));
                } else {
                    // In normal mode: store letter positions as targets
                    // and bits start at random positions
                    targetPositions.push(createVector(x, y));
                    bits.push(new Bit(x, y, soilColor));
                }
            }
        }
    }
    
    // Generate random targets for reverse mode
    if (isReverseMode) {
        generateRandomTargets(bits.length);
    }
}

function prepareImage() {
    offscreen.pixelDensity(1);
    
    // First, send the image URL to our server
    fetch('/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: 'image',
            content: imageData
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        // Create an image from the base64 data
        img = loadImage(data.image_data, 
            // Success callback
            () => {
                // Calculate scaling to fit the canvas while maintaining aspect ratio
                let scale = min(width / img.width, height / img.height);
                let scaledWidth = img.width * scale;
                let scaledHeight = img.height * scale;
                
                // Center the image
                let x = (width - scaledWidth) / 2;
                let y = (height - scaledHeight) / 2;
                
                offscreen.image(img, x, y, scaledWidth, scaledHeight);
                offscreen.loadPixels();
                
                // Increase step size for better performance
                let step = 8;
                for (let x = 0; x < offscreen.width; x += step) {
                    for (let y = 0; y < offscreen.height; y += step) {
                        let index = 4 * (x + y * offscreen.width);
                        let r = offscreen.pixels[index];
                        let g = offscreen.pixels[index+1];
                        let b = offscreen.pixels[index+2];
                        let a = offscreen.pixels[index+3];
                        if (a > 128) {
                            // For images, create bits with their original target positions
                            bits.push(new Bit(x, y, color(r, g, b), x, y));
                        }
                    }
                }
            },
            // Error callback
            () => {
                console.error("Error loading image");
                alert("Error loading image. Please check the URL and try again.");
            }
        );
    })
    .catch(error => {
        console.error("Error:", error);
        alert("Error loading image: " + error.message);
    });
}

function draw() {
    background(255);
    
    // Draw bits first (bottom layer)
    for (let b of bits) {
        fill(b.col);
        noStroke();
        ellipse(b.pos.x, b.pos.y, 7, 7);
    }
    
    // Draw ants on top (top layer)
    for (let ant of ants) {
        ant.update();
        ant.draw();
    }
} 