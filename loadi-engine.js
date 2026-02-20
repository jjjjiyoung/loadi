/**
 * Loadi Engine - The Core Game Loop
 * This file is included in the downloadable ZIP.
 */
class LoadiEngine {
    constructor(containerId, config = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Default Config
        this.config = Object.assign({
            theme: {
                background: '#000',
                playerColor: '#fff',
                obstacleColor: '#f00',
                accentColor: '#0ff'
            },
            sprites: {
                player: null, // 8x8 bitmap array
                obstacle: null
            },
            autoPlay: false
        }, config);

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Game State
        this.player = {
            x: 50, y: 0, w: 20, h: 20, dy: 0, jumpPower: 10, grounded: false
        };
        this.obstacles = [];
        this.frame = 0;
        this.score = 0;
        this.speed = 4;
        this.isPlaying = false;
        this.isGameOver = false;

        // Input
        this.handleInput = this.handleInput.bind(this);
        this.keyHandler = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                this.handleInput();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
        this.canvas.addEventListener('mousedown', this.handleInput);
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleInput(); });

        this.start();
    }

    // Clean up to prevent multiple listeners on regeneration
    destroy() {
        this.isPlaying = false;
        document.removeEventListener('keydown', this.keyHandler);
    }

    resize() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.groundY = this.canvas.height - 30;
    }

    start() {
        this.reset();
        this.isPlaying = true;
        this.loop();
    }

    reset() {
        this.player.y = this.groundY - this.player.h;
        this.player.dy = 0;
        this.obstacles = [];
        this.frame = 0;
        this.score = 0;
        this.speed = 4.5; // Slightly faster start
        this.isGameOver = false;
    }

    handleInput() {
        if (this.isGameOver) {
            this.start();
            return;
        }
        if (this.player.grounded) {
            this.player.dy = -this.player.jumpPower;
            this.player.grounded = false;
        }
    }

    update() {
        if (!this.isPlaying || this.isGameOver) return;

        // AI Auto Play Logic
        if (this.config.autoPlay) {
            this.autoPlayBot();
        }

        // Player Physics
        this.player.dy += 0.6; // Gravity
        this.player.y += this.player.dy;

        if (this.player.y > this.groundY - this.player.h) {
            this.player.y = this.groundY - this.player.h;
            this.player.dy = 0;
            this.player.grounded = true;
        }

        // Obstacles
        if (this.frame % Math.floor(1000 / (this.speed * 6)) === 0) { // Spawn rate based on speed
            // Random variation in spawn time
            if (Math.random() > 0.3) {
                 this.obstacles.push({
                    x: this.canvas.width,
                    y: this.groundY - 20, // Align with ground
                    w: 20,
                    h: 20 + Math.random() * 15 // Varying height
                });
            }
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.x -= this.speed;

            // Collision
            if (
                this.player.x < obs.x + obs.w &&
                this.player.x + this.player.w > obs.x &&
                this.player.y < obs.y + obs.h &&
                this.player.y + this.player.h > obs.y
            ) {
                if (this.config.autoPlay) {
                    // Bot shouldn't die usually, but if it does, just reset
                    this.reset();
                } else {
                    this.gameOver();
                }
            }

            if (obs.x + obs.w < 0) this.obstacles.splice(i, 1);
        }

        this.frame++;
        this.score = Math.floor(this.frame / 5);
        this.speed += 0.001; // Accelerate slowly
    }

    autoPlayBot() {
        // Simple lookahead
        const lookahead = 100 + (this.speed * 10);
        const incoming = this.obstacles.find(o => o.x > this.player.x && o.x < this.player.x + lookahead);
        
        if (incoming && this.player.grounded) {
            // Jump if close enough
            const dist = incoming.x - (this.player.x + this.player.w);
            if (dist < this.speed * 15) { // Jump timing based on speed
                this.handleInput();
            }
        }
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const theme = this.config.theme;

        // Background
        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, w, h);

        // Ground Line
        ctx.strokeStyle = theme.accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.groundY);
        ctx.lineTo(w, this.groundY);
        ctx.stroke();

        // Draw Player (Sprite or Rect)
        ctx.fillStyle = theme.playerColor;
        if (this.config.sprites.player) {
            this.drawSprite(this.config.sprites.player, this.player.x, this.player.y, this.player.w, this.player.h, theme.playerColor);
        } else {
            ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        }

        // Draw Obstacles
        ctx.fillStyle = theme.obstacleColor;
        this.obstacles.forEach(obs => {
             if (this.config.sprites.obstacle) {
                this.drawSprite(this.config.sprites.obstacle, obs.x, obs.y, obs.w, obs.h, theme.obstacleColor);
            } else {
                ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            }
        });

        // UI
        ctx.fillStyle = theme.accentColor;
        ctx.font = '14px Courier New';
        ctx.fillText(`SCORE: ${this.score}`, 10, 25);
        
        if (this.config.autoPlay) {
            ctx.fillStyle = '#ff0055';
            ctx.fillText("AUTO-PILOT", w - 100, 25);
        }

        if (this.isGameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.font = '20px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText("GAME OVER", w/2, h/2);
            ctx.font = '12px Courier New';
            ctx.fillText("Press Space to Restart", w/2, h/2 + 20);
            ctx.textAlign = 'left';
        }
    }

    drawSprite(bitmap, x, y, w, h, color) {
        // bitmap is 8x8 array of 0/1
        const cellW = w / 8;
        const cellH = h / 8;
        this.ctx.fillStyle = color;
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (bitmap[r * 8 + c] === 1) {
                    this.ctx.fillRect(x + c * cellW, y + r * cellH, cellW, cellH);
                }
            }
        }
    }

    gameOver() {
        this.isPlaying = false;
        this.isGameOver = true;
        this.draw(); // Draw game over screen
    }

    loop() {
        if (this.isPlaying && !this.isGameOver) {
            this.update();
            this.draw();
            requestAnimationFrame(() => this.loop());
        }
    }
}
