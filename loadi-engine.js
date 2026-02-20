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
                player: null,
                obstacle: null
            },
            autoPlay: false,
            gameType: 'RUNNER'
        }, config);

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        // State for managing loop
        this.isPlaying = false;
        this.isGameOver = false;
        this.animationFrameId = null;

        this.resize();
        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);

        // Game State
        this.player = {
            x: 50, y: 0, w: 20, h: 20, dx: 0, dy: 0, jumpPower: 10, grounded: false
        };
        this.obstacles = [];
        this.frame = 0;
        this.score = 0;
        this.speed = 4;
        this.difficulty = 1;

        this.keys = {};
        this.handleInput = this.handleInput.bind(this);
        this.keyHandlerDown = (e) => {
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
                this.handleInput();
            }
        };
        this.keyHandlerUp = (e) => this.keys[e.code] = false;
        
        document.addEventListener('keydown', this.keyHandlerDown);
        document.addEventListener('keyup', this.keyHandlerUp);
        this.canvas.addEventListener('mousedown', this.handleInput);
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleInput(); }, { passive: false });

        this.start();
    }

    destroy() {
        this.isPlaying = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('resize', this.resizeHandler);
        document.removeEventListener('keydown', this.keyHandlerDown);
        document.removeEventListener('keyup', this.keyHandlerUp);
        this.container.innerHTML = '';
    }

    resize() {
        if (!this.container || !this.canvas) return;
        this.canvas.width = this.container.clientWidth || 300;
        this.canvas.height = this.container.clientHeight || 200;
        
        // Ensure scale is never zero to avoid division/rendering issues
        this.scale = Math.max(0.1, this.canvas.height / 200);
        this.groundY = this.canvas.height - (30 * this.scale);
        
        if (this.player) {
            this.player.w = 20 * this.scale;
            this.player.h = 20 * this.scale;
        }
        
        // Only draw if we have a context and theme
        if (this.ctx && this.config && this.config.theme) {
            try {
                this.draw();
            } catch (e) {
                console.warn("Initial draw failed during resize:", e);
            }
        }
    }

    start() {
        try {
            this.reset();
            this.isPlaying = true;
            this.loop();
        } catch (e) {
            console.error("Failed to start engine:", e);
        }
    }

    reset() {
        this.frame = 0;
        this.score = 0;
        this.difficulty = 1;
        this.obstacles = [];
        this.isGameOver = false;
        
        // Physics randomization based on seed
        const seed = this.config.seed || 0;
        const s = this.scale || 1;
        const type = this.config ? this.config.gameType : 'RUNNER';

        // Variable gravity/jump based on seed
        this.gravity = (0.5 + (seed % 3) * 0.1) * s;
        this.jumpPower = (9 + (seed % 5) * 0.5) * s;

        if (type === 'RUNNER') {
            this.player.x = 50 * s;
            this.player.y = this.groundY - this.player.h;
            this.speed = 4.5 + (seed % 2);
        } else if (type === 'DODGE') {
            this.player.x = (this.canvas.width / 2) - (this.player.w / 2);
            this.player.y = this.groundY - this.player.h;
            this.speed = 3 + (seed % 2);
        } else if (type === 'FLAPPY') {
            this.player.x = 50 * s;
            this.player.y = this.canvas.height / 2;
            this.speed = 3.5 + (seed % 2);
            this.gravity = (0.3 + (seed % 2) * 0.1) * s;
        }
        
        this.player.dy = 0;
        this.player.grounded = false;
        this.trail = [];
    }

    handleInput() {
        if (this.isGameOver) {
            this.start();
            return;
        }
        
        if (this.config.gameType === 'RUNNER' && this.player.grounded) {
            this.player.dy = -this.jumpPower;
            this.player.grounded = false;
        } else if (this.config.gameType === 'FLAPPY') {
            this.player.dy = -this.jumpPower * 0.65;
        }
    }

    update() {
        if (!this.isPlaying || this.isGameOver) return;

        this.difficulty = 1 + (this.frame / 2000);
        const s = this.scale || 1;
        const currentSpeed = this.speed * this.difficulty * s;
        const spawnRate = Math.max(15, Math.floor(60 / this.difficulty));

        if (this.config.autoPlay) this.autoPlayBot(currentSpeed);

        // Update trail
        this.trail.unshift({ x: this.player.x, y: this.player.y });
        if (this.trail.length > 5) this.trail.pop();

        if (this.config.gameType === 'RUNNER') this.updateRunner(currentSpeed, spawnRate);
        else if (this.config.gameType === 'DODGE') this.updateDodge(currentSpeed, spawnRate);
        else if (this.config.gameType === 'FLAPPY') this.updateFlappy(currentSpeed, spawnRate);

        this.frame++;
        this.score = Math.floor(this.frame / 10);
    }

    updateRunner(speed, spawnRate) {
        const s = this.scale || 1;
        this.player.dy += this.gravity;
        this.player.y += this.player.dy;

        if (this.player.y > this.groundY - this.player.h) {
            this.player.y = this.groundY - this.player.h;
            this.player.dy = 0;
            this.player.grounded = true;
        }

        if (this.frame % spawnRate === 0) {
            const randType = Math.random();
            const type = randType > 0.8 ? 'TALL' : (randType > 0.6 ? 'DOUBLE' : 'NORMAL');
            this.obstacles.push({
                x: this.canvas.width,
                y: this.groundY - (type === 'TALL' ? 40 : 20) * s,
                w: (type === 'DOUBLE' ? 40 : 20) * s,
                h: (type === 'TALL' ? 40 : 20) * s,
                type: type
            });
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.x -= speed;
            if (this.checkCollision(this.player, obs)) this.onHit();
            if (obs.x + obs.w < 0) this.obstacles.splice(i, 1);
        }
    }

    updateDodge(speed, spawnRate) {
        const s = this.scale;
        const moveSpeed = 5 * s;
        if (this.keys['ArrowLeft']) this.player.x -= moveSpeed;
        if (this.keys['ArrowRight']) this.player.x += moveSpeed;
        
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));

        if (this.frame % spawnRate === 0) {
            const type = Math.random() > 0.7 ? 'ZIGZAG' : 'FALL';
            this.obstacles.push({
                x: Math.random() * (this.canvas.width - 20 * s),
                y: -20 * s,
                w: 20 * s,
                h: 20 * s,
                type: type,
                seed: Math.random() * 10
            });
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.y += speed;
            if (obs.type === 'ZIGZAG') {
                obs.x += Math.sin(this.frame / 10 + obs.seed) * 3 * s;
            }
            if (this.checkCollision(this.player, obs)) this.onHit();
            if (obs.y > this.canvas.height) this.obstacles.splice(i, 1);
        }
    }

    updateFlappy(speed, spawnRate) {
        const s = this.scale;
        this.player.dy += 0.3 * s;
        this.player.y += this.player.dy;

        if (this.player.y < 0 || this.player.y > this.canvas.height - this.player.h) this.onHit();

        if (this.frame % (spawnRate * 2) === 0) {
            const gap = (70 - Math.min(30, this.difficulty * 5)) * s;
            const gapY = Math.random() * (this.canvas.height - gap - 40 * s) + 20 * s;
            const pipeW = 30 * s;
            this.obstacles.push({ x: this.canvas.width, y: 0, w: pipeW, h: gapY, type: 'PIPE' });
            this.obstacles.push({ x: this.canvas.width, y: gapY + gap, w: pipeW, h: this.canvas.height - (gapY + gap), type: 'PIPE' });
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.x -= speed;
            if (this.checkCollision(this.player, obs)) this.onHit();
            if (obs.x + obs.w < 0) this.obstacles.splice(i, 1);
        }
    }

    checkCollision(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    onHit() {
        if (this.config.autoPlay) this.reset();
        else this.gameOver();
    }

    autoPlayBot(speed) {
        const s = this.scale;
        if (this.config.gameType === 'RUNNER') {
            const lookahead = 120 * s;
            const incoming = this.obstacles.find(o => o.x > this.player.x && o.x < this.player.x + lookahead);
            if (incoming && this.player.grounded) {
                const dist = incoming.x - (this.player.x + this.player.w);
                if (dist < speed * 12) this.handleInput();
            }
        } else if (this.config.gameType === 'DODGE') {
            const incoming = this.obstacles.find(o => o.y + o.h < this.player.y && o.y + o.h > this.player.y - 120 * s);
            if (incoming) {
                if (incoming.x + incoming.w/2 > this.player.x + this.player.w/2) this.player.x -= 5 * s;
                else this.player.x += 5 * s;
            }
        } else if (this.config.gameType === 'FLAPPY') {
            const incoming = this.obstacles.find(o => o.x + o.w > this.player.x);
            if (incoming) {
                const gapY = incoming.y === 0 ? incoming.h + 35 * s : incoming.y - 35 * s;
                if (this.player.y + this.player.h/2 > gapY) this.handleInput();
            }
        }
    }

    draw() {
        const ctx = this.ctx;
        if (!ctx || !this.config || !this.config.theme) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const s = this.scale || 1;
        const theme = this.config.theme;

        // Background
        const bg = theme.background || '#000';
        if (bg.includes('gradient')) {
             const grd = ctx.createLinearGradient(0, 0, 0, h);
             const colors = bg.match(/#[a-fA-F0-9]{6}/g);
             if (colors && colors.length >= 2) {
                 grd.addColorStop(0, colors[0]);
                 grd.addColorStop(1, colors[1]);
                 ctx.fillStyle = grd;
             } else ctx.fillStyle = '#000';
        } else ctx.fillStyle = bg;
        
        ctx.fillRect(0, 0, w, h);

        // Draw Trail
        if (this.trail) {
            this.trail.forEach((pos, i) => {
                const alpha = (5 - i) / 10;
                ctx.globalAlpha = alpha;
                if (this.config.sprites && this.config.sprites.player) {
                    this.drawSprite(this.config.sprites.player, pos.x, pos.y, this.player.w, this.player.h, pColor, 0);
                } else {
                    ctx.fillStyle = pColor;
                    ctx.fillRect(pos.x, pos.y, this.player.w, this.player.h);
                }
            });
            ctx.globalAlpha = 1;
        }

        if (this.config.gameType !== 'FLAPPY') {
            ctx.strokeStyle = theme.accentColor || '#0ff';
            ctx.lineWidth = Math.max(1, 2 * s);
            ctx.beginPath();
            ctx.moveTo(0, this.groundY);
            ctx.lineTo(w, this.groundY);
            ctx.stroke();
        }

        const pColor = theme.playerColor || '#fff';
        ctx.fillStyle = pColor;
        if (this.config.sprites && this.config.sprites.player) {
            this.drawSprite(this.config.sprites.player, this.player.x, this.player.y, this.player.w, this.player.h, pColor, 0);
        } else {
            ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        }

        const oColor = theme.obstacleColor || '#f00';
        this.obstacles.forEach(obs => {
            const rotation = (obs.type === 'ZIGZAG' || obs.type === 'NORMAL') ? this.frame / 20 : 0;
            if (this.config.sprites && this.config.sprites.obstacle && obs.type !== 'PIPE') {
                this.drawSprite(this.config.sprites.obstacle, obs.x, obs.y, obs.w, obs.h, oColor, rotation);
            } else {
                ctx.fillStyle = oColor;
                ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            }
        });

        const aColor = theme.accentColor || '#0ff';
        ctx.fillStyle = aColor;
        ctx.font = `${Math.floor(12 * s)}px Courier New`;
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${this.score}`, 10 * s, 20 * s);
        ctx.fillText(`DIFF: ${this.difficulty.toFixed(1)}x`, 10 * s, 35 * s);
        
        if (this.isGameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = `${Math.floor(20 * s)}px Courier New`;
            ctx.fillText("GAME OVER", w/2, h/2);
            ctx.font = `${Math.floor(10 * s)}px Courier New`;
            ctx.fillText("Click to Restart", w/2, h/2 + 30 * s);
            ctx.textAlign = 'left';
        }
    }

    drawSprite(bitmap, x, y, w, h, color, rotation = 0) {
        if (!bitmap) return;
        this.ctx.save();
        this.ctx.translate(x + w / 2, y + h / 2);
        this.ctx.rotate(rotation);
        const cellW = w / 8;
        const cellH = h / 8;
        this.ctx.fillStyle = color;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (bitmap[r * 8 + c] === 1) {
                    this.ctx.fillRect(-w/2 + c * cellW, -h/2 + r * cellH, Math.ceil(cellW), Math.ceil(cellH));
                }
            }
        }
        this.ctx.restore();
    }

    gameOver() {
        this.isPlaying = false;
        this.isGameOver = true;
        this.draw();
    }

    loop() {
        if (this.isPlaying && !this.isGameOver) {
            this.update();
            this.draw();
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        }
    }
}
