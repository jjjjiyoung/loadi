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
        this.dots = [];
        this.bullets = [];
        this.platforms = [];
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
        this.dots = [];
        this.bullets = [];
        this.platforms = [];
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
            this.gravity = (0.25 + (seed % 2) * 0.05) * s;
            this.jumpPower = (6 + (seed % 3) * 0.5) * s;
        } else if (type === 'MAZE') {
            this.player.x = 30 * s;
            this.player.y = 30 * s;
            this.speed = 2 * s;
            this.dots = [];
            this.walls = [];
            this.generateMaze();
            for(let i=0; i<20; i++) this.spawnDot();
        }
        
        this.player.dy = 0;
        this.player.dx = 0;
        this.player.grounded = false;
        this.trail = [];
    }

    generateMaze() {
        const s = this.scale || 1;
        const cols = 15;
        const rows = 10;
        const cellW = this.canvas.width / cols;
        const cellH = this.canvas.height / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Outer walls and random internal walls
                if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1 || 
                    (Math.random() > 0.75 && !(r === 1 && c === 1))) {
                    this.walls.push({ x: c * cellW, y: r * cellH, w: cellW, h: cellH });
                }
            }
        }
    }

    spawnDot() {
        const s = this.scale || 1;
        let valid = false;
        let dot = null;
        while (!valid) {
            dot = {
                x: Math.random() * (this.canvas.width - 20 * s) + 10 * s,
                y: Math.random() * (this.canvas.height - 20 * s) + 10 * s,
                w: 6 * s, h: 6 * s
            };
            valid = !this.walls.some(w => this.checkCollision(dot, w));
        }
        this.dots.push(dot);
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
        const currentSpeed = this.speed * this.difficulty;
        const spawnRate = Math.max(15, Math.floor(60 / this.difficulty));

        if (this.config.autoPlay) this.autoPlayBot(currentSpeed);

        // Update trail
        if (this.config.gameType !== 'MAZE') {
            this.trail.unshift({ x: this.player.x, y: this.player.y });
            if (this.trail.length > 5) this.trail.pop();
        }

        if (this.config.gameType === 'RUNNER') this.updateRunner(currentSpeed, spawnRate);
        else if (this.config.gameType === 'DODGE') this.updateDodge(currentSpeed, spawnRate);
        else if (this.config.gameType === 'FLAPPY') this.updateFlappy(currentSpeed, spawnRate);
        else if (this.config.gameType === 'MAZE') this.updateMaze(currentSpeed, spawnRate);
        else if (this.config.gameType === 'SHOOTER') this.updateShooter(currentSpeed, spawnRate);
        else if (this.config.gameType === 'JUMP') this.updateJump(currentSpeed, spawnRate);

        this.frame++;
        if (this.config.gameType !== 'MAZE') this.score = Math.floor(this.frame / 10);
    }

    updateShooter(speed, spawnRate) {
        const s = this.scale || 1;
        // Move
        if (this.keys['ArrowLeft']) this.player.x -= 4 * s;
        if (this.keys['ArrowRight']) this.player.x += 4 * s;
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));

        // Auto Fire
        if (this.frame % 15 === 0) {
            this.bullets.push({ x: this.player.x + this.player.w/2 - 2*s, y: this.player.y, w: 4*s, h: 10*s });
        }

        // Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].y -= 7 * s;
            if (this.bullets[i].y < 0) this.bullets.splice(i, 1);
        }

        // Spawn Enemies
        if (this.frame % spawnRate === 0) {
            this.obstacles.push({
                x: Math.random() * (this.canvas.width - 20 * s),
                y: -30 * s,
                w: 25 * s,
                h: 25 * s,
                hp: 1
            });
        }

        // Enemies & Collision
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            let destroyed = false;
            obs.y += speed * 0.8;
            
            if (this.checkCollision(this.player, obs)) this.onHit();

            for (let b = this.bullets.length - 1; b >= 0; b--) {
                if (this.checkCollision(this.bullets[b], obs)) {
                    obs.hp--;
                    this.bullets.splice(b, 1);
                    if (obs.hp <= 0) {
                        this.score += 50;
                        this.obstacles.splice(i, 1);
                        destroyed = true;
                        break;
                    }
                }
            }
            if (!destroyed && obs.y > this.canvas.height) this.obstacles.splice(i, 1);
        }
    }

    updateJump(speed, spawnRate) {
        const s = this.scale || 1;
        
        // Horizontal Move
        if (this.keys['ArrowLeft']) this.player.x -= 5 * s;
        if (this.keys['ArrowRight']) this.player.x += 5 * s;
        
        // Screen Wrap
        if (this.player.x < -this.player.w) this.player.x = this.canvas.width;
        if (this.player.x > this.canvas.width) this.player.x = -this.player.w;

        // Physics
        this.player.dy += 0.4 * s; // Gravity
        this.player.y += this.player.dy;

        // Platform Collision (Bounce)
        if (this.player.dy > 0) {
            this.platforms.forEach(p => {
                if (this.player.x + this.player.w > p.x && this.player.x < p.x + p.w &&
                    this.player.y + this.player.h > p.y && this.player.y + this.player.h < p.y + p.h + 10 * s) {
                    this.player.dy = -this.jumpPower;
                }
            });
        }

        // Camera Scroll (Move platforms down instead of player up)
        if (this.player.y < this.canvas.height / 2) {
            const diff = this.canvas.height / 2 - this.player.y;
            this.player.y = this.canvas.height / 2;
            this.platforms.forEach(p => p.y += diff);
            this.score += Math.floor(diff);
        }

        // Spawn Platforms
        const topPlat = this.platforms.reduce((min, p) => p.y < min ? p.y : min, this.canvas.height);
        if (topPlat > 50 * s) {
            this.platforms.push({
                x: Math.random() * (this.canvas.width - 40 * s),
                y: topPlat - (Math.random() * 40 * s + 60 * s),
                w: 40 * s,
                h: 8 * s
            });
        }

        // Remove old platforms
        this.platforms = this.platforms.filter(p => p.y < this.canvas.height);

        // Game Over
        if (this.player.y > this.canvas.height) this.onHit();
    }

    updateMaze(speed, spawnRate) {
        const s = this.scale || 1;
        const oldX = this.player.x;
        const oldY = this.player.y;
        
        if (this.keys['ArrowUp']) this.player.y -= speed;
        if (this.keys['ArrowDown']) this.player.y += speed;
        if (this.keys['ArrowLeft']) this.player.x -= speed;
        if (this.keys['ArrowRight']) this.player.x += speed;

        // Wall Collision
        if (this.walls.some(w => this.checkCollision(this.player, w))) {
            this.player.x = oldX;
            this.player.y = oldY;
        }

        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));
        this.player.y = Math.max(0, Math.min(this.canvas.height - this.player.h, this.player.y));

        // Collect Dots
        for (let i = this.dots.length - 1; i >= 0; i--) {
            if (this.checkCollision(this.player, this.dots[i])) {
                this.dots.splice(i, 1);
                this.score += 10;
                this.spawnDot();
            }
        }

        // Spawn Enemies (Ghosts)
        if (this.frame % (spawnRate * 2) === 0 && this.obstacles.length < 4) {
            this.obstacles.push({
                x: Math.random() > 0.5 ? 0 : this.canvas.width,
                y: Math.random() * this.canvas.height,
                w: 20 * s,
                h: 20 * s,
                type: 'GHOST'
            });
        }

        // Move Ghosts (Simple Chasing AI)
        this.obstacles.forEach(obs => {
            const dx = this.player.x - obs.x;
            const dy = this.player.y - obs.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                obs.x += (dx / dist) * speed * 0.6;
                obs.y += (dy / dist) * speed * 0.6;
            }
            if (this.checkCollision(this.player, obs)) this.onHit();
        });
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
        const s = this.scale || 1;
        this.player.dy += this.gravity || 0.4 * s;
        this.player.y += this.player.dy;

        // More forgiving bounds check
        if (this.player.y < -this.player.h * 2 || this.player.y > this.canvas.height + this.player.h) {
            this.onHit();
        }

        if (this.frame % (spawnRate * 2.5) === 0) {
            const gap = (80 - Math.min(30, this.difficulty * 4)) * s;
            const gapY = Math.random() * (this.canvas.height - gap - 60 * s) + 30 * s;
            const pipeW = 35 * s;
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
        } else if (this.config.gameType === 'MAZE') {
            // Target nearest dot
            if (this.dots && this.dots.length > 0) {
                const nearest = this.dots.reduce((prev, curr) => {
                    const d1 = Math.hypot(this.player.x - prev.x, this.player.y - prev.y);
                    const d2 = Math.hypot(this.player.x - curr.x, this.player.y - curr.y);
                    return d1 < d2 ? prev : curr;
                });
                
                if (nearest.x > this.player.x) this.player.x += speed * 0.5;
                else this.player.x -= speed * 0.5;
                if (nearest.y > this.player.y) this.player.y += speed * 0.5;
                else this.player.y -= speed * 0.5;
            }

            // Avoid nearest ghost
            const ghost = this.obstacles.find(o => Math.hypot(this.player.x - o.x, this.player.y - o.y) < 50 * s);
            if (ghost) {
                if (ghost.x > this.player.x) this.player.x -= speed * 0.8;
                else this.player.x += speed * 0.8;
                if (ghost.y > this.player.y) this.player.y -= speed * 0.8;
                else this.player.y += speed * 0.8;
            }
        } else if (this.config.gameType === 'SHOOTER') {
            // Track nearest enemy x
            const target = this.obstacles[0];
            if (target) {
                if (target.x + target.w/2 > this.player.x + this.player.w/2) this.player.x += speed;
                else this.player.x -= speed;
            }
        } else if (this.config.gameType === 'JUMP') {
            // Find platform above
            const target = this.platforms.find(p => p.y < this.player.y && p.y > this.player.y - 150 * s);
            if (target) {
                if (target.x + target.w/2 > this.player.x + this.player.w/2) this.player.x += 4 * s;
                else this.player.x -= 4 * s;
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

        // Draw MAZE Walls
        if (this.config.gameType === 'MAZE' && this.walls) {
            ctx.fillStyle = theme.accentColor || '#00f';
            this.walls.forEach(wall => ctx.fillRect(wall.x, wall.y, wall.w, wall.h));
        }

        // Draw MAZE Dots
        if (this.config.gameType === 'MAZE' && this.dots) {
            ctx.fillStyle = theme.accentColor || '#ff0';
            this.dots.forEach(dot => {
                ctx.beginPath();
                ctx.arc(dot.x + dot.w/2, dot.y + dot.h/2, dot.w/2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw SHOOTER Bullets
        if (this.config.gameType === 'SHOOTER' && this.bullets) {
            ctx.fillStyle = '#ff0';
            this.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
        }

        // Draw JUMP Platforms
        if (this.config.gameType === 'JUMP' && this.platforms) {
            ctx.fillStyle = theme.obstacleColor;
            this.platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));
        }

        // Draw Theme Particles
        this.drawBackgroundParticles(ctx, w, h, s);

        const pColor = theme.playerColor || '#fff';
        const oColor = theme.obstacleColor || '#f00';
        const aColor = theme.accentColor || '#0ff';

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
            ctx.strokeStyle = aColor;
            ctx.lineWidth = Math.max(1, 2 * s);
            ctx.beginPath();
            ctx.moveTo(0, this.groundY);
            ctx.lineTo(w, this.groundY);
            ctx.stroke();
        }

        ctx.fillStyle = pColor;
        if (this.config.sprites && this.config.sprites.player) {
            this.drawSprite(this.config.sprites.player, this.player.x, this.player.y, this.player.w, this.player.h, pColor, 0);
        } else {
            ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        }

        this.obstacles.forEach(obs => {
            const rotation = (obs.type === 'ZIGZAG' || obs.type === 'NORMAL') ? this.frame / 20 : 0;
            if (this.config.sprites && this.config.sprites.obstacle && obs.type !== 'PIPE') {
                this.drawSprite(this.config.sprites.obstacle, obs.x, obs.y, obs.w, obs.h, oColor, rotation);
            } else {
                ctx.fillStyle = oColor;
                ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            }
        });

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

    drawBackgroundParticles(ctx, w, h, s) {
        if (!this.config || !this.config.category) return;
        const category = this.config.category;
        const seed = this.config.seed || 0;
        
        ctx.fillStyle = this.config.theme.accentColor || '#fff';
        ctx.globalAlpha = 0.3;

        for (let i = 0; i < 15; i++) {
            const px = (Math.sin(seed + i * 100 + this.frame * 0.05) * 0.5 + 0.5) * w;
            const py = (Math.cos(seed + i * 200 + this.frame * 0.02) * 0.5 + 0.5) * h;
            
            if (category === 'SPACE') { // Twinkling Stars
                const size = (Math.sin(this.frame * 0.1 + i) * 1 + 2) * s;
                ctx.fillRect(px, py, size, size);
            } else if (category === 'WATER') { // Floating Bubbles
                const ry = (py + this.frame * 0.5) % h;
                ctx.beginPath();
                ctx.arc(px, ry, 3 * s, 0, Math.PI * 2);
                ctx.fill();
            } else if (category === 'AIR') { // Moving Clouds
                const rx = (px - this.frame * 0.3) % w;
                ctx.fillRect(rx < 0 ? rx + w : rx, py, 20 * s, 10 * s);
            } else if (category === 'URBAN') { // Falling Rain
                const ry = (py + this.frame * 2) % h;
                ctx.fillRect(px, ry, 1 * s, 10 * s);
            } else if (category === 'CYBER') { // Matrix Code
                const ry = (py + this.frame * 1.5) % h;
                ctx.font = `${10 * s}px monospace`;
                ctx.fillText(String.fromCharCode(33 + (this.frame + i) % 94), px, ry);
            }
        }
        ctx.globalAlpha = 1;
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
