/**
 * Loadi - Lightweight Embedded Pixel Game Solution
 * @version 1.1.0
 * @description A zero-dependency game library to engage users during loading times.
 */
class Loadi {
    constructor(options = {}) {
        this.options = {
            target: options.target || document.body,
            width: options.width || '100%',
            height: options.height || 150,
            theme: {
                background: options.theme?.background || '#081008',
                primary: options.theme?.primary || '#33ff33', // Retro Green
                secondary: options.theme?.secondary || '#ffcc00' // Accent
            },
            autoProgress: options.autoProgress !== false, // Simulate loading
            onComplete: options.onComplete || (() => {})
        };

        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isPlaying = false;
        this.progress = 0;
        
        // Game State
        this.player = { x: 50, y: 0, w: 20, h: 20, dy: 0, jump: -7, grounded: false };
        this.obstacles = [];
        this.frame = 0;
        this.score = 0;
        
        this.init();
    }

    init() {
        // Create Container
        this.container = document.querySelector(this.options.target);
        if (!this.container) throw new Error('Loadi: Target element not found');

        // Setup DOM
        this.wrapper = document.createElement('div');
        this.wrapper.style.cssText = `
            position: relative;
            width: ${this.options.width};
            height: ${this.options.height}px;
            background: ${this.options.theme.background};
            overflow: hidden;
            font-family: 'Courier New', monospace;
            border: 2px solid ${this.options.theme.primary};
            user-select: none;
            cursor: pointer;
        `;

        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.width = this.container.clientWidth; 
        this.canvas.height = this.options.height;
        
        this.ctx = this.canvas.getContext('2d');

        // UI Overlay (Start/Score)
        this.ui = document.createElement('div');
        this.ui.style.cssText = `
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            color: ${this.options.theme.primary};
            text-align: center;
            pointer-events: none;
            text-shadow: 1px 1px 0 #000;
        `;
        this.ui.innerHTML = '<span style="font-size: 14px; animation: blink 1s infinite;">TAP or SPACE to JUMP</span>';

        // Progress Bar
        this.barContainer = document.createElement('div');
        this.barContainer.style.cssText = `
            position: absolute; bottom: 0; left: 0;
            width: 100%; height: 4px;
            background: rgba(255,255,255,0.1);
        `;
        this.bar = document.createElement('div');
        this.bar.style.cssText = `
            width: 0%; height: 100%;
            background: ${this.options.theme.primary};
            transition: width 0.2s;
        `;
        this.barContainer.appendChild(this.bar);

        this.wrapper.appendChild(this.canvas);
        this.wrapper.appendChild(this.ui);
        this.wrapper.appendChild(this.barContainer);
        this.container.appendChild(this.wrapper);

        // Bind Events with named functions for removal
        this.handleInput = this.handleInput.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        this.wrapper.addEventListener('click', this.handleInput);
        this.wrapper.addEventListener('touchstart', this.handleInput, { passive: false });
        window.addEventListener('keydown', this.handleKeyDown);

        // Initial Draw
        this.reset();
        this.draw();
    }

    handleKeyDown(e) {
        if (e.code === 'Space') {
            this.handleInput(e);
        }
    }

    handleInput(e) {
        if (e && e.type !== 'touchstart') e.preventDefault();
        
        if (!this.isPlaying) {
            this.start();
        } else if (this.player.grounded) {
            this.player.dy = this.player.jump;
            this.player.grounded = false;
        }
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.ui.style.display = 'none';
        this.loop();
    }

    reset() {
        this.player.y = this.canvas.height - 30;
        this.player.dy = 0;
        this.obstacles = [];
        this.frame = 0;
        this.score = 0;
        this.progress = 0;
    }

    update() {
        // Gravity
        this.player.dy += 0.4;
        this.player.y += this.player.dy;

        // Ground Collision
        const groundY = this.canvas.height - this.player.h - 10;
        if (this.player.y > groundY) {
            this.player.y = groundY;
            this.player.dy = 0;
            this.player.grounded = true;
        }

        // Spawn Obstacles
        if (this.frame % 100 === 0) { // Slightly faster spawn
            this.obstacles.push({
                x: this.canvas.width,
                y: groundY,
                w: 15,
                h: 20
            });
        }

        // Move Obstacles
        this.obstacles.forEach((obs, i) => {
            obs.x -= 3.5; // Speed

            // Collision
            if (
                this.player.x < obs.x + obs.w - 5 && // Hitbox adjustment
                this.player.x + this.player.w - 5 > obs.x &&
                this.player.y < obs.y + obs.h &&
                this.player.y + this.player.h > obs.y
            ) {
                this.gameOver();
            }

            if (obs.x + obs.w < 0) this.obstacles.splice(i, 1);
        });

        // Auto Progress Logic
        if (this.options.autoProgress && this.progress < 100) {
            this.progress += 0.05;
            this.updateProgress(this.progress);
        } else if (this.progress >= 100) {
            this.options.onComplete();
            this.stop();
        }

        this.frame++;
    }

    draw() {
        const { width, height } = this.canvas;
        const { primary, secondary, background } = this.options.theme;

        this.ctx.fillStyle = background;
        this.ctx.fillRect(0, 0, width, height);

        // Draw Player
        this.ctx.fillStyle = secondary;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        // Eye
        this.ctx.fillStyle = background;
        this.ctx.fillRect(this.player.x + 12, this.player.y + 4, 4, 4);

        // Draw Obstacles
        this.ctx.fillStyle = primary;
        this.obstacles.forEach(obs => {
            this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        });

        // Draw Score
        this.ctx.fillStyle = primary;
        this.ctx.font = '12px Courier New';
        this.ctx.fillText(`SCORE: ${Math.floor(this.frame / 10)}`, 10, 20);
    }

    loop() {
        if (!this.isPlaying) return;
        this.update();
        this.draw();
        this.animationId = requestAnimationFrame(() => this.loop());
    }

    gameOver() {
        this.isPlaying = false;
        this.ui.style.display = 'block';
        this.ui.innerHTML = `GAME OVER<br>Score: ${Math.floor(this.frame / 10)}<br><span style="font-size:10px">Tap to Retry</span>`;
        this.reset();
    }

    stop() {
        this.isPlaying = false;
        cancelAnimationFrame(this.animationId);
    }

    updateProgress(percent) {
        this.progress = percent; // Sync internal state
        this.bar.style.width = `${percent}%`;
    }

    /**
     * Clean up all event listeners and remove DOM elements
     */
    destroy() {
        this.stop();
        window.removeEventListener('keydown', this.handleKeyDown);
        this.wrapper.removeEventListener('click', this.handleInput);
        this.wrapper.removeEventListener('touchstart', this.handleInput);
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }
    }
}

// Export for module usage or global
if (typeof module !== 'undefined') module.exports = Loadi;
else window.Loadi = Loadi;