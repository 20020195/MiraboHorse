// Professional Canvas-Based Fireworks Engine
// Inspired by CodePen fireworks with realistic physics

class FireworksCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            // Create canvas if it doesn't exist
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
            this.canvas.style.position = 'absolute';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.pointerEvents = 'none';
            this.canvas.style.zIndex = '10';

            // EXTREME BLOOM (+50%): brightness 2.4, saturate 3.3, contrast 1.8, blur 0.75px
            this.canvas.style.filter = 'brightness(2.4) saturate(3.3) contrast(1.8) blur(0.75px)';
            this.canvas.style.mixBlendMode = 'screen'; // Make colors pop!

            // Append to celebration overlay instead of body
            const celebrationOverlay = document.getElementById('celebration-overlay');
            if (celebrationOverlay) {
                celebrationOverlay.appendChild(this.canvas);
            } else {
                document.body.appendChild(this.canvas);
            }
        }

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.rockets = [];
        this.active = false;
        this.animationFrame = null;
        this.launchInterval = null;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Physics constants
        this.gravity = 0.05;
        this.friction = 0.98;

        // Colors
        this.colors = [
            '#FFD700', '#FFF700', '#FFAA00', // Golds
            '#FF1744', '#FF0055', '#FF6E40', // Reds
            '#00E5FF', '#00BCD4', '#2196F3', // Blues
            '#76FF03', '#00E676', '#69F0AE', // Greens
            '#E040FB', '#D500F9', '#EA80FC', // Purples
            '#FF4081', '#F50057', '#FF80AB'  // Pinks
        ];
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    start() {
        this.active = true;
        this.canvas.style.display = 'block';
        this.animate();

        // Launch fireworks continuously (reduced spawn rate)
        this.launchInterval = setInterval(() => {
            if (this.active) {
                // Count active rockets (rockets that haven't exploded yet)
                const activeRockets = this.rockets.filter(r => !r.exploded).length;

                // Only launch if we have less than 20 active fireworks
                if (activeRockets < 20) {
                    // Launch 2-3 rockets at a time
                    const count = Math.min(Math.floor(Math.random() * 2) + 2, 20 - activeRockets);
                    for (let i = 0; i < count; i++) {
                        setTimeout(() => this.launchRocket(), i * 150);
                    }
                }
            }
        }, 800); // Check every 0.8 seconds
    }

    stop() {
        this.active = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        if (this.launchInterval) {
            clearInterval(this.launchInterval);
            this.launchInterval = null;
        }
        this.particles = [];
        this.rockets = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.style.display = 'none';
    }

    launchRocket() {
        const x = Math.random() * this.canvas.width * 0.6 + this.canvas.width * 0.2;
        const targetY = Math.random() * this.canvas.height * 0.1 + this.canvas.height * 0.01;

        // Randomly decide if this will be a heart (1 in 3 chance)
        const willBeHeart = Math.random() < 0.33;

        // Heart colors: pink, red, magenta
        const heartColors = ['#FF1493', '#FF69B4', '#FF1744', '#FF0055', '#FF4081', '#F50057'];
        const normalColors = this.colors;

        const color = willBeHeart
            ? heartColors[Math.floor(Math.random() * heartColors.length)]
            : normalColors[Math.floor(Math.random() * normalColors.length)];

        this.rockets.push({
            x: x,
            y: this.canvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: -(Math.random() * 3.9 + 18.6), // Increased by 30%: was (3 + 12), now (3.9 + 15.6)
            targetY: targetY,
            color: color,
            trail: [],
            exploded: false,
            isHeart: willBeHeart // Store heart flag
        });
    }

    createExplosion(x, y, color, forceHeart = false) {
        // PERFORMANCE OPTIMIZATION: Reduced particle count significantly
        const particleCount = Math.floor(Math.random() * 20) + 30; // 30-50 instead of 80-130

        // Force heart explosion if requested, otherwise random type
        let explosionType;
        if (forceHeart) {
            explosionType = 2; // Heart shape
        } else {
            explosionType = Math.floor(Math.random() * 6); // Now 6 types including heart!
        }

        for (let i = 0; i < particleCount; i++) {
            let angle, speed;

            switch (explosionType) {
                case 0: // Circle
                    angle = (Math.PI * 2 * i) / particleCount;
                    speed = Math.random() * 3 + 3;
                    break;

                case 1: // Ring
                    angle = (Math.PI * 2 * i) / particleCount;
                    speed = Math.random() * 1 + 5;
                    break;

                case 2: // Heart shape - FROM WEBGL SHADER
                    // Start with circle, then modify Y coordinate
                    const angle_deg = (360 * i) / particleCount;
                    const angle_rad = (angle_deg * Math.PI) / 180;

                    let x_heart = Math.cos(angle_rad);
                    let y_heart = Math.sin(angle_rad);

                    // KEY FORMULA: y = y + |x| * sqrt((8 - |x|) / 50)
                    y_heart = y_heart + Math.abs(x_heart) * Math.sqrt((8.0 - Math.abs(x_heart)) / 50.0);

                    // FLIP IT: Negate Y to make heart point upwards
                    y_heart = -y_heart;

                    // Now calculate angle and speed from the heart coordinates
                    angle = Math.atan2(y_heart, x_heart);

                    // Use distance from origin as speed variation
                    const dist = Math.sqrt(x_heart * x_heart + y_heart * y_heart);
                    speed = dist * 3.0; // Scale to reasonable speed
                    break;

                case 3: // Star
                    const starPoint = i % 10;
                    angle = (Math.PI * 2 * starPoint) / 10;
                    speed = (starPoint % 2 === 0 ? 5 : 2) + Math.random();
                    break;

                default: // Random burst
                    angle = Math.random() * Math.PI * 2;
                    speed = Math.random() * 4 + 2;
            }

            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                alpha: 1,
                decay: Math.random() * 0.02 + 0.015, // Faster decay
                size: Math.random() * 2 + 1.5, // Smaller particles
                trail: []
            });
        }
    }

    updateRockets() {
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const rocket = this.rockets[i];

            // Calculate distance to target
            const distanceToTarget = rocket.y - rocket.targetY;
            const progressRatio = Math.max(0, Math.min(1, distanceToTarget / (this.canvas.height * 0.5)));

            // Progressive deceleration: the closer to target, the more we slow down
            const deceleration = (1 - progressRatio) * 0.15; // 0 at start, 0.15 at target

            // Update position
            rocket.x += rocket.vx;
            rocket.y += rocket.vy;

            // Apply gravity AND progressive deceleration
            rocket.vy += this.gravity * 1; // Normal gravity
            rocket.vy *= (1 - deceleration); // Slow down more as we get closer

            // Add trail
            rocket.trail.push({ x: rocket.x, y: rocket.y });
            if (rocket.trail.length > 8) {
                rocket.trail.shift();
            }

            // Check if reached target height or going down
            if (rocket.y <= rocket.targetY || rocket.vy > 0) {
                if (!rocket.exploded) {
                    this.createExplosion(rocket.x, rocket.y, rocket.color, rocket.isHeart);
                    rocket.exploded = true;
                }
                this.rockets.splice(i, 1);
            }
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            // Update position
            p.x += p.vx;
            p.y += p.vy;

            // Apply physics
            p.vx *= this.friction;
            p.vy *= this.friction;
            p.vy += this.gravity;

            // EXTRA LONG TRAILS (+30% = 10 frames)
            p.trail.push({ x: p.x, y: p.y, alpha: p.alpha });
            if (p.trail.length > 15) {
                p.trail.shift();
            }

            // Fade out
            p.alpha -= p.decay;

            // Remove dead particles
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        // CRITICAL: Clear canvas to be TRANSPARENT (not black) so celebration text shows through
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // PERFORMANCE: Disable shadows globally for speed
        this.ctx.shadowBlur = 0;

        // Draw rocket trails
        this.rockets.forEach(rocket => {
            this.ctx.strokeStyle = rocket.color;
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            rocket.trail.forEach((pos, index) => {
                if (index === 0) {
                    this.ctx.moveTo(pos.x, pos.y);
                } else {
                    this.ctx.lineTo(pos.x, pos.y);
                }
            });
            this.ctx.stroke();

            // Draw rocket head
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(rocket.x, rocket.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // PERFORMANCE: Batch drawing by color to reduce state changes
        const particlesByColor = {};
        this.particles.forEach(p => {
            if (!particlesByColor[p.color]) {
                particlesByColor[p.color] = [];
            }
            particlesByColor[p.color].push(p);
        });

        // Draw particles with short trails
        Object.keys(particlesByColor).forEach(color => {
            particlesByColor[color].forEach(p => {
                // Draw trail (short, 3 points)
                p.trail.forEach((pos, index) => {
                    const trailAlpha = (index / p.trail.length) * p.alpha;
                    const alpha = Math.floor(trailAlpha * 255).toString(16).padStart(2, '0');
                    this.ctx.fillStyle = p.color + alpha;
                    this.ctx.beginPath();
                    const trailSize = p.size * (0.6 + trailAlpha * 0.4);
                    this.ctx.arc(pos.x, pos.y, trailSize, 0, Math.PI * 2);
                    this.ctx.fill();
                });

                // Draw main particle with glow
                const alpha = Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
                this.ctx.fillStyle = p.color + alpha;

                // EXTREME GLOW (+30% = 40px blur)
                this.ctx.shadowBlur = 40;
                this.ctx.shadowColor = p.color;

                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();

                // Reset shadow
                this.ctx.shadowBlur = 0;
            });
        });
    }

    animate() {
        if (!this.active) return;

        this.updateRockets();
        this.updateParticles();
        this.draw();

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
}

// Create global instance
window.professionalFireworks = new FireworksCanvas('fireworks-canvas');
