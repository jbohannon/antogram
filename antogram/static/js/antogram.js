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
let img;       // for image mode
let offscreen; // offscreen graphics for drawing text/image

// Add these constants at the top with other constants
const MAX_NEAREST_CHECKS = 30;   // tune for quality vs. speed especially on Android
const ANT_FRAME_WIDTH = 96;
const ANT_FRAME_HEIGHT = 101;
const ANT_NUM_FRAMES = 4;
const ANT_SCALE = 0.25;
const ANT_PIXELS_PER_STEP = 8;

// Global Job Queue System for efficient ant coordination
class JobManager {
    static jobs = [];
    static availableJobs = [];
    static completedJobs = 0;
    
    static createJob(sourcePos, destPos) {
        const job = {
            id: this.jobs.length,
            sourcePos: {x: sourcePos.x, y: sourcePos.y},
            destPos: {x: destPos.x, y: destPos.y},
            reserved: false,
            completed: false,
            bit: null  // Will hold the actual bit when picked up
        };
        this.jobs.push(job);
        this.availableJobs.push(job);
        return job;
    }
    
    static claimNearestJob(antPos) {
        if (this.availableJobs.length === 0) return null;
        
        let bestJob = null;
        let bestScore = Infinity;
        let bestIndex = -1;
        
        // Bias toward earlier jobs in the pre-sorted list + distance
        for (let i = 0; i < this.availableJobs.length; i++) {
            const job = this.availableJobs[i];
            if (job.reserved) continue;
            
            const dx = job.sourcePos.x - antPos.x;
            const dy = job.sourcePos.y - antPos.y;
            const distSq = dx * dx + dy * dy;
            
            // Bias score: prefer jobs earlier in the sorted list
            const positionBias = i * 1000; // Earlier jobs get lower scores
            const score = distSq + positionBias;
            
            if (score < bestScore) {
                bestScore = score;
                bestJob = job;
                bestIndex = i;
            }
        }
        
        if (bestJob) {
            bestJob.reserved = true;
            // Remove from available jobs for efficiency
            this.availableJobs.splice(bestIndex, 1);
        }
        
        return bestJob;
    }
    
    static completeJob(job) {
        job.completed = true;
        this.completedJobs++;
    }
    
    static reset() {
        this.jobs = [];
        this.availableJobs = [];
        this.completedJobs = 0;
    }
    
    static sortJobsForWritingBias() {
        // Pre-sort jobs by left-to-right, top-to-bottom preference with slight randomness
        // Only apply in normal mode (not reverse mode)
        if (!isReverseMode) {
            this.availableJobs.sort((a, b) => {
                // Stronger left-to-right bias, less random noise
                const aScore = (a.destPos.x / width) * 2 + (a.destPos.y / height) + random(-0.1, 0.1);
                const bScore = (b.destPos.x / width) * 2 + (b.destPos.y / height) + random(-0.1, 0.1);
                return aScore - bScore; // Top-left jobs come first
            });
        }
    }
    
    static getProgress() {
        return this.jobs.length > 0 ? this.completedJobs / this.jobs.length : 0;
    }
}

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


// Function to prepare landing page with "Write with ants" message
function prepareLandingPage() {
    message = "Write with ants";
    mode = "text";
    isReverseMode = true;
    isLandingPage = true;
    
    // Prepare the text and positions
    prepareText();
}

// Simplified Bit class for job system
class Bit {
  constructor(x, y, col) {
    this.pos = createVector(x, y);
    this.col = col;
    this.carried = false;
    this.delivered = false;
  }
}

// Simplified Ant class using job queue system
class Ant {
    constructor() {
        this.pos = createVector(random(width), random(height));
        this.velocity = p5.Vector.random2D().mult(2);
        this.maxSpeed = IS_MOBILE ? 4.5 : 3;  // 50% faster on mobile
        this.distanceTraveled = 0;
        
        // Job-based behavior
        this.currentJob = null;
        this.carrying = null;
        this.targetPos = null;  // Current movement target (source or dest)
        this.state = 'seeking_job';  // 'seeking_job', 'going_to_source', 'going_to_dest'
        
        // Smooth wandering behavior
        this.wanderTarget = null;
        this.wanderDistance = 0;
        this.maxWanderDistance = random(100, 200);  // Distance before choosing new direction
    }

    update() {
        // Job-based behavior state machine
        switch (this.state) {
            case 'seeking_job':
                if (!this.currentJob) {
                    this.currentJob = JobManager.claimNearestJob(this.pos);
                    if (this.currentJob) {
                        this.targetPos = createVector(this.currentJob.sourcePos.x, this.currentJob.sourcePos.y);
                        this.state = 'going_to_source';
                    }
                }
                break;
                
            case 'going_to_source':
                if (this.targetPos && p5.Vector.dist(this.pos, this.targetPos) < 5) {
                    // Arrived at source - pick up any available bit
                    this.pickupNearestBit();
                    if (this.carrying) {
                        this.targetPos = createVector(this.currentJob.destPos.x, this.currentJob.destPos.y);
                        this.state = 'going_to_dest';
                    }
                }
                break;
                
            case 'going_to_dest':
                if (this.carrying && this.targetPos && p5.Vector.dist(this.pos, this.targetPos) < 5) {
                    // Arrived at destination - complete job
                    this.dropBit();
                    JobManager.completeJob(this.currentJob);
                    this.currentJob = null;
                    this.state = 'seeking_job';
                }
                break;
        }
        
        // Simple movement toward target
        if (this.targetPos) {
            this.moveToward(this.targetPos);
        } else {
            this.wander();
        }
        
        // Update distance for animation
        this.distanceTraveled += this.velocity.mag();
        
        // Keep ants within canvas bounds
        this.pos.x = constrain(this.pos.x, 0, width);
        this.pos.y = constrain(this.pos.y, 0, height);
    }
    
    moveToward(target) {
        let desired = p5.Vector.sub(target, this.pos);
        desired.setMag(this.maxSpeed);
        
        let steer = p5.Vector.sub(desired, this.velocity);
        steer.limit(0.3);
        this.velocity.add(steer);
        this.velocity.limit(this.maxSpeed);
        this.pos.add(this.velocity);
        
        // Update carried bit position
        if (this.carrying) {
            let bitOffset = p5.Vector.fromAngle(this.velocity.heading());
            bitOffset.mult(ANT_FRAME_WIDTH * ANT_SCALE * 0.6);
            this.carrying.pos.x = this.pos.x + bitOffset.x;
            this.carrying.pos.y = this.pos.y + bitOffset.y;
        }
    }
    
    wander() {
        // Smooth wandering - pick a direction and stick with it for a while
        if (!this.wanderTarget || this.wanderDistance >= this.maxWanderDistance) {
            // Choose a new wander direction (limited angle change for smoothness)
            let currentHeading = this.velocity.heading();
            let angleOffset = random(-PI/3, PI/3);  // ±60 degrees max change
            let newHeading = currentHeading + angleOffset;
            
            // Create wander target in the new direction
            this.wanderTarget = p5.Vector.fromAngle(newHeading)
                .mult(this.maxWanderDistance)
                .add(this.pos);
                
            this.wanderDistance = 0;
            this.maxWanderDistance = random(100, 200);  // Vary distance before next direction change
        }
        
        // Move toward wander target
        let desired = p5.Vector.sub(this.wanderTarget, this.pos);
        desired.setMag(this.maxSpeed * 0.7);  // Slower wandering
        
        let steer = p5.Vector.sub(desired, this.velocity);
        steer.limit(0.1);  // Gentle steering
        this.velocity.add(steer);
        this.velocity.limit(this.maxSpeed * 0.7);
        this.pos.add(this.velocity);
        
        // Track distance traveled
        this.wanderDistance += this.velocity.mag();
        
        // Handle wall collisions - bounce off walls smoothly
        if (this.pos.x <= 10 || this.pos.x >= width-10 || this.pos.y <= 10 || this.pos.y >= height-10) {
            // Choose new direction away from wall
            let centerX = width / 2;
            let centerY = height / 2;
            let toCenter = createVector(centerX - this.pos.x, centerY - this.pos.y);
            toCenter.normalize();
            toCenter.mult(this.maxWanderDistance);
            
            this.wanderTarget = p5.Vector.add(this.pos, toCenter);
            this.wanderDistance = 0;
        }
    }
    
    pickupNearestBit() {
        for (let bit of bits) {
            if (!bit.carried && !bit.delivered && p5.Vector.dist(this.pos, bit.pos) < 10) {
                this.carrying = bit;
                bit.carried = true;
                this.currentJob.bit = bit;
                break;
            }
        }
    }
    
    dropBit() {
        if (this.carrying) {
            // Place bit at destination with slight randomness
            this.carrying.pos.x = this.targetPos.x + random(-2, 2);
            this.carrying.pos.y = this.targetPos.y + random(-2, 2);
            this.carrying.delivered = true;
            this.carrying.carried = false;
            this.carrying = null;
            this.targetPos = null;
        }
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
    
    // Clear existing arrays and reset job system
    bits = [];
    ants = [];
    JobManager.reset();
    
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
                    // Reverse mode: bits start at text positions, jobs go to random destinations
                    let sourcePos = createVector(x, y);  // Text position
                    let destPos = createVector(random(width), random(height));  // Random destination
                    
                    // Create bit at text position with small jiggle (already formed)
                    bits.push(new Bit(sourcePos.x + random(-2, 2), sourcePos.y + random(-2, 2), soilColor));
                    
                    // Create job to move it to random position (disassemble)
                    JobManager.createJob(sourcePos, destPos);
                } else {
                    // Normal mode: bits start at random positions, jobs go to text destinations
                    let sourcePos = createVector(random(width), random(height));  // Random source
                    let destPos = createVector(x, y);  // Text position
                    
                    // Create bit at random position
                    bits.push(new Bit(sourcePos.x, sourcePos.y, soilColor));
                    
                    // Create job to move it to text position (assemble)
                    JobManager.createJob(sourcePos, destPos);
                }
            }
        }
    }
    
    // Sort jobs for left-to-right writing bias (once, not per ant!)
    JobManager.sortJobsForWritingBias();
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
                            // Create bits at random source positions
                            let sourcePos = createVector(random(offscreen.width), random(offscreen.height));
                            let destPos = createVector(x, y);
                            
                            // Create bit at source position
                            bits.push(new Bit(sourcePos.x, sourcePos.y, color(r, g, b)));
                            
                            // Create job linking source to destination
                            JobManager.createJob(sourcePos, destPos);
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