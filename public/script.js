const socket = io();

// Shared Logic
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Initialize Global Effects
window.onload = function () {
    startSakuraEffect();
    // Only spawn clouds on Host view (NOT on player view)
    if (!document.getElementById('player-view')) {
        startCloudEffect();
    }
};

function startSakuraEffect() {
    setInterval(createPetal, 300);
}

function startCloudEffect() {
    // Initial clouds
    createCloud();
    setTimeout(createCloud, 2000);
    // Recurring clouds
    setInterval(createCloud, 5000);
}

function createCloud() {
    const cloud = document.createElement('div');
    cloud.classList.add('cloud');

    // Randomize size
    const size = Math.random() * 150 + 100; // 100-250px
    cloud.style.width = size + 'px';
    cloud.style.height = (size * 0.6) + 'px';

    // Randomize vertical position (Sky area - Top 1/3)
    cloud.style.top = Math.random() * 30 + 'vh';

    // Randomize speed
    const duration = Math.random() * 10 + 20; // 20-30s (Slow drift)
    cloud.style.animationDuration = duration + 's';

    document.body.appendChild(cloud);

    setTimeout(() => cloud.remove(), duration * 1000);
}

function createPetal() {
    const petal = document.createElement('div');
    petal.classList.add('petal');

    // Randomize properties
    // Start mostly from right side to diagonal left
    const startLeft = Math.random() * 120; // 0-120vw (allow starting offscreen right)
    const duration = Math.random() * 5 + 5;
    const size = Math.random() * 10 + 10;

    petal.style.left = startLeft + 'vw';
    petal.style.animationDuration = duration + 's';
    petal.style.width = size + 'px';
    petal.style.height = size + 'px';

    document.body.appendChild(petal);

    // Cleanup
    setTimeout(() => {
        petal.remove();
    }, duration * 1000);
}

// Background Music
const bgm = new Audio('assets/music.mp3');
bgm.loop = true;

function startGame() {
    bgm.play().catch(e => console.log('Audio play failed:', e));
    socket.emit('start_game');
}

function resetGame() {
    bgm.pause();
    bgm.currentTime = 0;
    socket.emit('reset_game');
}

// Host Logic
function initHost() {
    const horse = document.getElementById('horse');
    const qrCodeImg = document.getElementById('qr-code-large');
    const playerCountValue = document.getElementById('player-count-value');
    const celebrationOverlay = document.getElementById('celebration-overlay');

    // Keyboard event listener for shortcuts
    document.addEventListener('keydown', (e) => {
        // Shift + R: Return to lobby (from anywhere)
        if ((e.key === 'r' || e.key === 'R') && e.shiftKey) {
            resetGame(); // This returns to lobby
        }
        // R only: Restart game during celebration or racing
        else if ((e.key === 'r' || e.key === 'R') && !e.shiftKey) {
            // During celebration overlay
            if (celebrationOverlay.classList.contains('active')) {
                resetGame();
            }
            // During active gameplay - restart from beginning
            else if (gameScreen.style.display === 'flex' || gameScreen.style.display === 'block') {
                // Reset to lobby then immediately restart
                socket.emit('reset_game');
                setTimeout(() => {
                    socket.emit('start_game');
                }, 200); // Wait for reset to complete
            }
        }
    });

    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');

    // Fetch and display QR Code
    const hostUrl = window.location.protocol + '//' + window.location.host;
    // const hostUrl = window.location.protocol + '//' + '192.168.1.13:3000'; // For local testing hardcode if needed
    const playerUrl = hostUrl + '/player.html';

    fetch(`/qrcode?url=${encodeURIComponent(playerUrl)}`)
        .then(res => res.json())
        .then(data => {
            if (qrCodeImg) qrCodeImg.src = data.qrImage;
        });

    socket.on('player_count', (count) => {
        if (playerCountValue) playerCountValue.innerText = count;
    });

    // Handle initial state (e.g. on reload)
    socket.on('init_state', (state) => {
        if (state.status === 'playing') {
            lobbyScreen.style.display = 'none';
            gameScreen.style.display = 'flex';

            // Sync horse position
            const maxLeft = document.querySelector('.race-track').offsetWidth - 300;
            const currentLeft = (state.progress / 100) * maxLeft;
            horse.style.left = `${currentLeft}px`;

            // Restore progress bar
            const progressBar = document.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${state.progress}%`;
            }

            // Restore heart counter value and position
            const heartCounter = document.getElementById('heart-counter');
            const heartCountValue = document.getElementById('heart-count-value');
            if (heartCounter && heartCountValue) {
                heartCountValue.innerText = state.totalHearts || 0;
                // Clamp position between 5% and 98% to ensure heart counter is always visible
                const clampedProgress = Math.max(5, Math.min(98, state.progress * 0.93 + 5));
                heartCounter.style.left = `${clampedProgress}%`;
            }

            // Restore running animation and parallax if in progress
            if (state.progress > 0 && state.progress < 100) {
                horse.classList.add('running');
                document.body.classList.add('is-running');
            }

            // Attempt to resume audio (might be blocked by browser policy until interaction)
            bgm.play().catch(e => console.log('Autoplay prevented on reload:', e));
        } else if (state.status === 'finished') {
            // Optional: Show celebration if they reload on finished screen
            // For now, maybe just lobby or game screen frozen
            // Start fresh or existing state
        }
    });

    socket.on('game_started', () => {
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'flex'; // Enable game view
    });

    let runTimeout;

    socket.on('update_progress', (data) => {
        if (!gameScreen || gameScreen.style.display === 'none') return;

        let progress = 0;
        let totalHearts = 0;

        // Handle both old (number) and new (object) payload formats for backward compatibility/safety
        if (typeof data === 'number') {
            progress = data;
        } else {
            progress = data.progress;
            totalHearts = data.totalHearts;
        }

        // Ensure music is playing
        if (bgm.paused) {
            bgm.play().catch(() => { });
        }

        // Map progress (0-100)
        const maxLeft = document.querySelector('.race-track').offsetWidth - 300;
        const currentLeft = (progress / 100) * maxLeft;

        horse.style.left = `${currentLeft}px`;

        // Update Progress Bar
        const progressBar = document.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        // Update Heart Counter
        const heartCounter = document.getElementById('heart-counter');
        const heartCountValue = document.getElementById('heart-count-value');
        if (heartCounter && heartCountValue) {
            heartCountValue.innerText = totalHearts;
            // Clamp position between 5% and 98% to ensure heart counter is always visible
            const clampedProgress = Math.max(5, Math.min(100, progress * 0.95 + 5));
            heartCounter.style.left = `${clampedProgress}%`;
        }

        if (progress > 0 && progress < 100) {
            // Running State (Bounce + Dust)
            horse.classList.add('running');
            document.body.classList.add('is-running'); // Start clouds

            // Reset Idle Timeout (Stop bounce/dust if idle)
            clearTimeout(runTimeout);
            runTimeout = setTimeout(() => {
                horse.classList.remove('running');
                document.body.classList.remove('is-running'); // Stop clouds
            }, 500);
        } else {
            // Finished or Reset
            horse.classList.remove('running');
            document.body.classList.remove('is-running');
            clearTimeout(runTimeout);
        }
    });

    socket.on('heart_received', () => {
        createFloatingHeart();
    });

    socket.on('game_over', () => {
        celebrationOverlay.classList.add('active');
        triggerConfetti();
        launchFireworks(); // Launch spectacular fireworks!
        bgm.pause();
        bgm.currentTime = 0;
    });

    socket.on('reset_game', () => {
        celebrationOverlay.classList.remove('active');
        stopFireworks(); // Stop continuous fireworks
        lobbyScreen.style.display = 'flex';
        gameScreen.style.display = 'none';
        horse.style.left = '0px';
        horse.classList.remove('running');
        bgm.pause();
        bgm.currentTime = 0;
    });
}

function createFloatingHeart() {
    const heart = document.createElement('div');
    heart.classList.add('floating-heart');
    // Random position across the screen
    const randomLeft = Math.random() * 90 + 5;
    heart.style.left = `${randomLeft}vw`;
    heart.style.bottom = '10vh';
    document.body.appendChild(heart);

    setTimeout(() => {
        heart.remove();
    }, 2000);
}

// Fireworks Effect - Using Professional Canvas Engine
function launchFireworks() {
    if (window.professionalFireworks) {
        window.professionalFireworks.start();
    }
}

function stopFireworks() {
    if (window.professionalFireworks) {
        window.professionalFireworks.stop();
    }
}

function createFirework(colors) {
    const startX = Math.random() * 70 + 15; // Random X position (15-85%)
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Create rocket
    const rocket = document.createElement('div');
    rocket.className = 'firework-rocket';
    rocket.style.left = `${startX}%`;
    rocket.style.background = color;
    rocket.style.boxShadow = `0 0 20px ${color}, 0 0 40px ${color}`;
    document.body.appendChild(rocket);

    // Explode at random height
    const explodeHeight = Math.random() * 35 + 15; // 15-50% from top

    setTimeout(() => {
        rocket.remove();
        createExplosion(startX, explodeHeight, color);
    }, 700);
}

function createExplosion(x, y, color) {
    // Randomly choose explosion pattern
    const patterns = ['ring', 'heart', 'star', 'willow', 'chrysanthemum', 'doubleRing'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];

    switch (pattern) {
        case 'heart':
            createHeartExplosion(x, y, color);
            break;
        case 'star':
            createStarExplosion(x, y, color);
            break;
        case 'willow':
            createWillowExplosion(x, y, color);
            break;
        case 'chrysanthemum':
            createChrysanthemumExplosion(x, y, color);
            break;
        case 'doubleRing':
            createDoubleRingExplosion(x, y, color);
            break;
        default:
            createRingExplosion(x, y, color);
    }
}

// Ring/Circle explosion - classic burst
function createRingExplosion(x, y, color) {
    const particleCount = 60;

    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = Math.random() * 100 + 100;
        createParticle(x, y, color, Math.cos(angle) * velocity, Math.sin(angle) * velocity, 2000);
    }
}

// Heart-shaped explosion
function createHeartExplosion(x, y, color) {
    const particleCount = 80;

    for (let i = 0; i < particleCount; i++) {
        const t = (i / particleCount) * Math.PI * 2;
        // Heart curve parametric equation
        const heartX = 16 * Math.pow(Math.sin(t), 3);
        const heartY = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));

        const scale = 8;
        createParticle(x, y, color, heartX * scale, heartY * scale, 2200);
    }
}

// Star-shaped explosion
function createStarExplosion(x, y, color) {
    const points = 5;
    const particlesPerPoint = 15;

    for (let i = 0; i < points * 2; i++) {
        const angle = (Math.PI * 2 * i) / (points * 2);
        const radius = (i % 2 === 0) ? 120 : 50; // Alternating long and short points

        for (let j = 0; j < particlesPerPoint; j++) {
            const variance = (j / particlesPerPoint) * radius;
            const tx = Math.cos(angle) * variance;
            const ty = Math.sin(angle) * variance;
            createParticle(x, y, color, tx, ty, 2000);
        }
    }
}

// Willow explosion - particles fall like a weeping willow
function createWillowExplosion(x, y, color) {
    const particleCount = 70;

    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const upVelocity = Math.random() * 50 + 80;
        const sideVelocity = Math.cos(angle) * (Math.random() * 40 + 20);

        createParticle(x, y, color, sideVelocity, -upVelocity, 2500, true); // gravity enabled
    }
}

// Chrysanthemum - multiple layers expanding
function createChrysanthemumExplosion(x, y, color) {
    const layers = 3;
    const particlesPerLayer = 30;

    for (let layer = 0; layer < layers; layer++) {
        setTimeout(() => {
            const radius = 80 + (layer * 40);
            for (let i = 0; i < particlesPerLayer; i++) {
                const angle = (Math.PI * 2 * i) / particlesPerLayer;
                const tx = Math.cos(angle) * radius;
                const ty = Math.sin(angle) * radius;
                createParticle(x, y, color, tx, ty, 1800);
            }
        }, layer * 100);
    }
}

// Double Ring - two concentric rings
function createDoubleRingExplosion(x, y, color) {
    const innerParticles = 40;
    const outerParticles = 60;

    // Inner ring
    for (let i = 0; i < innerParticles; i++) {
        const angle = (Math.PI * 2 * i) / innerParticles;
        const velocity = 70;
        createParticle(x, y, color, Math.cos(angle) * velocity, Math.sin(angle) * velocity, 1800);
    }

    // Outer ring with slight delay
    setTimeout(() => {
        for (let i = 0; i < outerParticles; i++) {
            const angle = (Math.PI * 2 * i) / outerParticles;
            const velocity = 130;
            createParticle(x, y, color, Math.cos(angle) * velocity, Math.sin(angle) * velocity, 2200);
        }
    }, 150);
}

// Helper function to create individual particles
function createParticle(x, y, color, tx, ty, duration, gravity = false) {
    const particle = document.createElement('div');
    particle.className = 'firework-particle';
    if (gravity) particle.classList.add('gravity');

    particle.style.left = `${x}%`;
    particle.style.top = `${y}%`;
    particle.style.background = color;
    particle.style.boxShadow = `0 0 15px ${color}, 0 0 30px ${color}`;

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);

    document.body.appendChild(particle);

    setTimeout(() => {
        particle.remove();
    }, duration);
}

function triggerConfetti() {
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDuration = Math.random() * 2 + 2 + 's';
        confetti.style.backgroundColor = Math.random() > 0.5 ? '#FFD700' : '#8B0000';
        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 4000);
    }
}

// Player Logic
function initPlayer() {
    const btn = document.getElementById('heart-btn');
    const celebrationOverlay = document.getElementById('celebration-overlay');
    const waitingScreen = document.getElementById('waiting-screen');
    const tapArea = document.getElementById('tap-area');

    // Notify server this is a player
    socket.emit('join_game');

    socket.on('init_state', (state) => {
        if (state.status === 'playing') {
            waitingScreen.style.display = 'none';
            tapArea.style.display = 'flex';
        } else {
            waitingScreen.style.display = 'flex';
            tapArea.style.display = 'none';
        }
    });

    socket.on('game_started', () => {
        waitingScreen.style.display = 'none';
        tapArea.style.display = 'flex';
    });

    socket.on('game_over', () => {
        celebrationOverlay.classList.add('active');
        tapArea.style.display = 'none'; // Hide button on finish
    });

    socket.on('reset_game', () => {
        celebrationOverlay.classList.remove('active');
        waitingScreen.style.display = 'flex';
        tapArea.style.display = 'none';
    });

    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        sendHeart();
        btn.style.transform = 'scale(0.8)';
        setTimeout(() => btn.style.transform = 'scale(1)', 100);
    });

    btn.addEventListener('click', (e) => {
        sendHeart();
    });

    function sendHeart() {
        socket.emit('send_heart');
        // Local feedback
        const heartClone = btn.querySelector('img').cloneNode(true);
        heartClone.style.position = 'absolute';
        heartClone.style.width = '50px';
        heartClone.style.left = '50%';
        heartClone.style.top = '50%';
        heartClone.style.transition = 'all 0.5s ease-out';
        document.body.appendChild(heartClone);

        setTimeout(() => {
            heartClone.style.top = '-100px';
            heartClone.style.opacity = '0';
        }, 10);
        setTimeout(() => {
            heartClone.remove();
        }, 500);
    }
}
