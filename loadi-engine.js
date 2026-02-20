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
        this.walls = [];
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
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.handleInput();
        });
        this.canvas.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.touches[0].clientX - rect.left;
            this.mouseY = e.touches[0].clientY - rect.top;
            this.handleInput(); 
        }, { passive: false });

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
        
        this.scale = Math.max(0.1, this.canvas.height / 200);
        this.groundY = this.canvas.height - (30 * this.scale);
        
        if (this.player) {
            this.player.w = 20 * this.scale;
            this.player.h = 20 * this.scale;
        }
        
        if (this.ctx && this.config && this.config.theme) {
            try { this.draw(); } catch (e) {}
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
        this.walls = [];
        this.isGameOver = false;
        
        const seed = this.config.seed || 0;
        const s = this.scale || 1;
        const type = this.config ? this.config.gameType : 'RUNNER';

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
            this.generateMaze();
            this.player.x = cellW_maze * 1.5;
            this.player.y = cellH_maze * 1.5;
            this.speed = 2 * s;
            for(let i=0; i<20; i++) this.spawnDot();
        } else if (type === 'PUZZLE') {
            this.puzzleGrid = [];
            const cols = 6, rows = 5;
            const size = 30 * s;
            const offsetX = (this.canvas.width - cols * size) / 2;
            const offsetY = (this.canvas.height - rows * size) / 2;
            for(let r=0; r<rows; r++) {
                for(let c=0; c<cols; c++) {
                    this.puzzleGrid.push({
                        r, c, x: offsetX + c * size, y: offsetY + r * size,
                        w: size, h: size,
                        type: Math.floor(Math.random() * 5)
                    });
                }
            }
            this.selectedGem = null;
        } else if (type === 'STACK') {
            const bw = 80 * s;
            this.stackBlocks = [{ x: (this.canvas.width - bw)/2, y: this.canvas.height - 25 * s, w: bw, h: 20*s }];
            this.currentStackBlock = { x: 0, y: this.canvas.height - 45 * s, w: bw, h: 20*s, dir: 1 };
            this.speed = 3 * s;
            this.combo = 0;
        } else if (type === 'GRAVITY') {
            this.player.x = 50 * s;
            this.player.y = this.groundY - this.player.h;
            this.player.gravityDir = 1; 
            this.speed = 4 * s;
            this.topY = 30 * s;
        } else if (type === 'SHOOTER') {
            this.player.x = this.canvas.width / 2 - 10 * s;
            this.player.y = this.canvas.height - 40 * s;
            this.speed = 3 * s;
        }
        
        this.player.dy = 0;
        this.player.dx = 0;
        this.player.grounded = false;
        this.trail = [];
    }

    generateMaze() {
        const s = this.scale || 1;
        const cols = 15, rows = 10;
        window.cellW_maze = this.canvas.width / cols;
        window.cellH_maze = this.canvas.height / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const isEdge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
                // Periodic pillar walls to ensure connectivity
                const isPillar = (r % 2 === 0 && c % 2 === 0) && (Math.random() > 0.4);
                const isSpawnSafe = r < 3 && c < 3;
                
                if (isEdge || (isPillar && !isSpawnSafe)) {
                    this.walls.push({ x: c * window.cellW_maze, y: r * window.cellH_maze, w: window.cellW_maze, h: window.cellH_maze });
                }
            }
        }
    }

    spawnDot() {
        const s = this.scale || 1;
        let valid = false, dot = null;
        while (!valid) {
            dot = { x: Math.random() * (this.canvas.width - 20 * s) + 10 * s, y: Math.random() * (this.canvas.height - 20 * s) + 10 * s, w: 6 * s, h: 6 * s };
            valid = !this.walls.some(w => this.checkCollision(dot, w));
        }
        this.dots.push(dot);
    }

    handleInput() {
        if (this.isGameOver) { this.start(); return; }
        const type = this.config.gameType;
        
        if (type === 'RUNNER' && this.player.grounded) {
            this.player.dy = -this.jumpPower;
            this.player.grounded = false;
        } else if (type === 'FLAPPY') {
            this.player.dy = -this.jumpPower * 0.65;
        } else if (type === 'STACK') {
            const last = this.stackBlocks[this.stackBlocks.length - 1];
            const diff = this.currentStackBlock.x - last.x;
            const absDiff = Math.abs(diff);
            
            if (absDiff < this.currentStackBlock.w) {
                const newWidth = this.currentStackBlock.w - absDiff;
                const newX = diff > 0 ? this.currentStackBlock.x : last.x;
                this.stackBlocks.push({ x: newX, y: this.currentStackBlock.y, w: newWidth, h: this.currentStackBlock.h });
                this.score += 100;
                this.currentStackBlock.w = newWidth;
                this.currentStackBlock.y -= this.currentStackBlock.h;
                this.speed += 0.2 * this.scale;
                if (this.stackBlocks.length > 6) {
                    const shift = this.currentStackBlock.h;
                    this.stackBlocks.forEach(b => b.y += shift);
                    this.currentStackBlock.y += shift;
                    this.stackBlocks.shift();
                }
            } else { this.gameOver(); }
        } else if (type === 'PUZZLE') {
            const clicked = this.puzzleGrid.find(g => 
                this.mouseX > g.x && this.mouseX < g.x + g.w &&
                this.mouseY > g.y && this.mouseY < g.y + g.h
            );
            if (clicked) {
                if (!this.selectedGem) { this.selectedGem = clicked; }
                else {
                    const dist = Math.abs(this.selectedGem.r - clicked.r) + Math.abs(this.selectedGem.c - clicked.c);
                    if (dist === 1) {
                        const temp = this.selectedGem.type;
                        this.selectedGem.type = clicked.type;
                        clicked.type = temp;
                        if (this.checkPuzzleMatches().length > 0) { this.score += 50; }
                        else { clicked.type = this.selectedGem.type; this.selectedGem.type = temp; }
                    }
                    this.selectedGem = null;
                }
            }
        } else if (type === 'GRAVITY') { this.player.gravityDir *= -1; }
    }

    update() {
        if (!this.isPlaying || this.isGameOver) return;
        this.difficulty = 1 + (this.frame / 2000);
        const s = this.scale || 1, currentSpeed = this.speed * this.difficulty, spawnRate = Math.max(15, Math.floor(60 / this.difficulty));
        if (this.config.autoPlay) this.autoPlayBot(currentSpeed);
        const type = this.config.gameType;
        if (!['MAZE', 'PUZZLE', 'STACK'].includes(type)) {
            this.trail.unshift({ x: this.player.x, y: this.player.y });
            if (this.trail.length > 5) this.trail.pop();
        }
        if (type === 'RUNNER') this.updateRunner(currentSpeed, spawnRate);
        else if (type === 'DODGE') this.updateDodge(currentSpeed, spawnRate);
        else if (type === 'FLAPPY') this.updateFlappy(currentSpeed, spawnRate);
        else if (type === 'MAZE') this.updateMaze(currentSpeed, spawnRate);
        else if (type === 'SHOOTER') this.updateShooter(currentSpeed, spawnRate);
        else if (type === 'JUMP') this.updateJump(currentSpeed, spawnRate);
        else if (type === 'PUZZLE') this.updatePuzzle();
        else if (type === 'STACK') this.updateStack(currentSpeed);
        else if (type === 'GRAVITY') this.updateGravity(currentSpeed, spawnRate);
        this.frame++;
        if (!['MAZE', 'PUZZLE', 'STACK', 'JUMP'].includes(type)) this.score = Math.floor(this.frame / 10);
    }

    updateShooter(speed, spawnRate) {
        const s = this.scale || 1;
        if (this.keys['ArrowLeft']) this.player.x -= 4 * s;
        if (this.keys['ArrowRight']) this.player.x += 4 * s;
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));
        if (this.frame % 15 === 0) this.bullets.push({ x: this.player.x + this.player.w/2 - 2*s, y: this.player.y, w: 4*s, h: 10*s });
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].y -= 7 * s;
            if (this.bullets[i].y < 0) this.bullets.splice(i, 1);
        }
        if (this.frame % spawnRate === 0) this.obstacles.push({ x: Math.random() * (this.canvas.width - 20 * s), y: -30 * s, w: 25 * s, h: 25 * s, hp: 1 });
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            let destroyed = false;
            obs.y += speed * 0.8;
            if (this.checkCollision(this.player, obs)) this.onHit();
            for (let b = this.bullets.length - 1; b >= 0; b--) {
                if (this.checkCollision(this.bullets[b], obs)) {
                    obs.hp--; this.bullets.splice(b, 1);
                    if (obs.hp <= 0) { this.score += 50; this.obstacles.splice(i, 1); destroyed = true; break; }
                }
            }
            if (!destroyed && obs.y > this.canvas.height) this.obstacles.splice(i, 1);
        }
    }

    updateJump(speed, spawnRate) {
        const s = this.scale || 1;
        if (this.keys['ArrowLeft']) this.player.x -= 5 * s;
        if (this.keys['ArrowRight']) this.player.x += 5 * s;
        if (this.player.x < -this.player.w) this.player.x = this.canvas.width;
        if (this.player.x > this.canvas.width) this.player.x = -this.player.w;
        this.player.dy += 0.4 * s; this.player.y += this.player.dy;
        if (this.player.dy > 0) {
            this.platforms.forEach(p => {
                if (this.player.x + this.player.w > p.x && this.player.x < p.x + p.w &&
                    this.player.y + this.player.h > p.y && this.player.y + this.player.h < p.y + p.h + 10 * s) { this.player.dy = -this.jumpPower; }
            });
        }
        if (this.player.y < this.canvas.height / 2) {
            const diff = this.canvas.height / 2 - this.player.y; this.player.y = this.canvas.height / 2;
            this.platforms.forEach(p => p.y += diff); this.score += Math.floor(diff);
        }
        const topPlat = this.platforms.reduce((min, p) => p.y < min ? p.y : min, this.canvas.height);
        if (topPlat > 50 * s) this.platforms.push({ x: Math.random() * (this.canvas.width - 40 * s), y: topPlat - (Math.random() * 40 * s + 60 * s), w: 40 * s, h: 8 * s });
        this.platforms = this.platforms.filter(p => p.y < this.canvas.height);
        if (this.player.y > this.canvas.height) this.onHit();
    }

    updateMaze(speed, spawnRate) {
        const s = this.scale || 1, oldX = this.player.x, oldY = this.player.y;
        if (this.keys['ArrowUp']) this.player.y -= speed;
        if (this.keys['ArrowDown']) this.player.y += speed;
        if (this.keys['ArrowLeft']) this.player.x -= speed;
        if (this.keys['ArrowRight']) this.player.x += speed;
        if (this.walls.some(w => this.checkCollision(this.player, w))) { this.player.x = oldX; this.player.y = oldY; }
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));
        this.player.y = Math.max(0, Math.min(this.canvas.height - this.player.h, this.player.y));
        for (let i = this.dots.length - 1; i >= 0; i--) { if (this.checkCollision(this.player, this.dots[i])) { this.dots.splice(i, 1); this.score += 10; this.spawnDot(); } }
        
        if (this.frame % (spawnRate * 2) === 0 && this.obstacles.length < 4) {
            let gx, gy, valid = false;
            while(!valid) {
                gx = Math.random() * (this.canvas.width - 20 * s); gy = Math.random() * (this.canvas.height - 20 * s);
                const temp = { x: gx, y: gy, w: 20*s, h: 20*s };
                valid = !this.walls.some(w => this.checkCollision(temp, w)) && Math.hypot(this.player.x - gx, this.player.y - gy) > 100 * s;
            }
            this.obstacles.push({ x: gx, y: gy, w: 20*s, h: 20*s, type: 'GHOST' });
        }
        this.obstacles.forEach(obs => {
            const ox = obs.x, oy = obs.y, dx = this.player.x - obs.x, dy = this.player.y - obs.y, dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                const moveX = (dx / dist) * speed * 0.5, moveY = (dy / dist) * speed * 0.5;
                obs.x += moveX; if (this.walls.some(w => this.checkCollision(obs, w))) obs.x = ox;
                obs.y += moveY; if (this.walls.some(w => this.checkCollision(obs, w))) obs.y = oy;
            }
            if (this.checkCollision(this.player, obs)) this.onHit();
        });
    }

    updateGravity(speed, spawnRate) {
        const s = this.scale || 1; this.player.dy += 0.6 * s * this.player.gravityDir; this.player.y += this.player.dy;
        if (this.player.y > this.groundY - this.player.h) { this.player.y = this.groundY - this.player.h; this.player.dy = 0; }
        if (this.player.y < this.topY) { this.player.y = this.topY; this.player.dy = 0; }
        if (this.frame % spawnRate === 0) {
            const onCeiling = Math.random() > 0.5;
            this.obstacles.push({ x: this.canvas.width, y: onCeiling ? this.topY : this.groundY - 20 * s, w: 20 * s, h: 20 * s, onCeiling });
        }
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i]; obs.x -= speed;
            if (this.checkCollision(this.player, obs)) this.onHit();
            if (obs.x + obs.w < 0) this.obstacles.splice(i, 1);
        }
    }

    updateRunner(speed, spawnRate) {
        const s = this.scale || 1; this.player.dy += this.gravity; this.player.y += this.player.dy;
        if (this.player.y > this.groundY - this.player.h) { this.player.y = this.groundY - this.player.h; this.player.dy = 0; this.player.grounded = true; }
        if (this.frame % spawnRate === 0) {
            const rt = Math.random(), type = rt > 0.8 ? 'TALL' : (rt > 0.6 ? 'DOUBLE' : 'NORMAL');
            this.obstacles.push({ x: this.canvas.width, y: this.groundY - (type === 'TALL' ? 40 : 20) * s, w: (type === 'DOUBLE' ? 40 : 20) * s, h: (type === 'TALL' ? 40 : 20) * s, type });
        }
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i]; obs.x -= speed;
            if (this.checkCollision(this.player, obs)) this.onHit();
            if (obs.x + obs.w < 0) this.obstacles.splice(i, 1);
        }
    }

    updateDodge(speed, spawnRate) {
        const s = this.scale || 1;
        if (this.keys['ArrowLeft']) this.player.x -= 5 * s;
        if (this.keys['ArrowRight']) this.player.x += 5 * s;
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.w, this.player.x));
        if (this.frame % spawnRate === 0) this.obstacles.push({ x: Math.random() * (this.canvas.width - 20 * s), y: -20 * s, w: 20 * s, h: 20 * s, type: Math.random() > 0.7 ? 'ZIGZAG' : 'FALL', seed: Math.random() * 10 });
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i]; obs.y += speed;
            if (obs.type === 'ZIGZAG') obs.x += Math.sin(this.frame / 10 + obs.seed) * 3 * s;
            if (this.checkCollision(this.player, obs)) this.onHit();
            if (obs.y > this.canvas.height) this.obstacles.splice(i, 1);
        }
    }

    updateFlappy(speed, spawnRate) {
        const s = this.scale || 1; this.player.dy += this.gravity || 0.4 * s; this.player.y += this.player.dy;
        if (this.player.y < -this.player.h * 2 || this.player.y > this.canvas.height + this.player.h) this.onHit();
        if (this.frame % Math.floor(spawnRate * 2.5) === 0) {
            const gap = (80 - Math.min(30, this.difficulty * 4)) * s, gapY = Math.random() * (this.canvas.height - gap - 60 * s) + 30 * s;
            this.obstacles.push({ x: this.canvas.width, y: 0, w: 35 * s, h: gapY, type: 'PIPE' });
            this.obstacles.push({ x: this.canvas.width, y: gapY + gap, w: 35 * s, h: this.canvas.height - (gapY + gap), type: 'PIPE' });
        }
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i]; obs.x -= speed;
            if (this.checkCollision(this.player, obs)) this.onHit();
            if (obs.x + obs.w < 0) this.obstacles.splice(i, 1);
        }
    }

    updatePuzzle() {
        if (this.frame % 60 === 0) {
            const matches = this.checkPuzzleMatches();
            if (matches.length > 0) { matches.forEach(gem => gem.type = Math.floor(Math.random() * 5)); this.score += matches.length * 10; }
        }
    }

    checkPuzzleMatches() {
        const matches = new Set();
        for(let r=0; r<5; r++) {
            for(let c=0; c<6; c++) {
                const g1 = this.puzzleGrid.find(g => g.r === r && g.c === c);
                const g2 = this.puzzleGrid.find(g => g.r === r && g.c === c+1);
                const g3 = this.puzzleGrid.find(g => g.r === r && g.c === c+2);
                if (g1 && g2 && g3 && g1.type === g2.type && g2.type === g3.type) { matches.add(g1); matches.add(g2); matches.add(g3); }
                const v2 = this.puzzleGrid.find(g => g.r === r+1 && g.c === c);
                const v3 = this.puzzleGrid.find(g => g.r === r+2 && g.c === c);
                if (g1 && v2 && v3 && g1.type === v2.type && v2.type === v3.type) { matches.add(g1); matches.add(v2); matches.add(v3); }
            }
        }
        return Array.from(matches);
    }

    updateStack(speed) {
        this.currentStackBlock.x += speed * this.currentStackBlock.dir;
        if (this.currentStackBlock.x < 0 || this.currentStackBlock.x + this.currentStackBlock.w > this.canvas.width) this.currentStackBlock.dir *= -1;
    }

    checkCollision(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

    onHit() { if (this.config.autoPlay) this.reset(); else this.gameOver(); }

    autoPlayBot(speed) {
        const s = this.scale || 1;
        const type = this.config.gameType;
        if (type === 'RUNNER') {
            const lookahead = 120 * s, incoming = this.obstacles.find(o => o.x > this.player.x && o.x < this.player.x + lookahead);
            if (incoming && this.player.grounded) { if (incoming.x - (this.player.x + this.player.w) < speed * 12) this.handleInput(); }
        } else if (type === 'DODGE') {
            const incoming = this.obstacles.find(o => o.y + o.h < this.player.y && o.y + o.h > this.player.y - 120 * s);
            if (incoming) { if (incoming.x + incoming.w/2 > this.player.x + this.player.w/2) this.player.x -= 5 * s; else this.player.x += 5 * s; }
        } else if (type === 'FLAPPY') {
            const incoming = this.obstacles.find(o => o.x + o.w > this.player.x);
            if (incoming) { const gapY = incoming.y === 0 ? incoming.h + 35 * s : incoming.y - 35 * s; if (this.player.y + this.player.h/2 > gapY) this.handleInput(); }
        } else if (type === 'MAZE') {
            if (this.dots && this.dots.length > 0) {
                const nearest = this.dots.reduce((prev, curr) => Math.hypot(this.player.x - prev.x, this.player.y - prev.y) < Math.hypot(this.player.x - curr.x, this.player.y - curr.y) ? prev : curr);
                if (nearest.x > this.player.x) this.player.x += speed * 0.5; else this.player.x -= speed * 0.5;
                if (nearest.y > this.player.y) this.player.y += speed * 0.5; else this.player.y -= speed * 0.5;
            }
        } else if (type === 'SHOOTER') {
            const target = this.obstacles[0];
            if (target) { if (target.x + target.w/2 > this.player.x + this.player.w/2) this.player.x += speed; else this.player.x -= speed; }
        } else if (type === 'JUMP') {
            const target = this.platforms.find(p => p.y < this.player.y && p.y > this.player.y - 150 * s);
            if (target) { if (target.x + target.w/2 > this.player.x + this.player.w/2) this.player.x += 4 * s; else this.player.x -= 4 * s; }
        } else if (type === 'STACK') {
            const last = this.stackBlocks[this.stackBlocks.length - 1];
            if (Math.abs(this.currentStackBlock.x - last.x) < 5 * s) this.handleInput();
        } else if (type === 'GRAVITY') {
            const incoming = this.obstacles.find(o => o.x > this.player.x && o.x < this.player.x + 150 * s);
            if (incoming) {
                const onSameSide = (this.player.gravityDir === 1 && !incoming.onCeiling) || (this.player.gravityDir === -1 && incoming.onCeiling);
                if (onSameSide && Math.abs(incoming.x - this.player.x) < 100 * s) this.handleInput();
            }
        } else if (type === 'PUZZLE') {
            if (this.frame % 120 === 0) this.handleInput();
        }
    }

    draw() {
        const ctx = this.ctx; if (!ctx || !this.config || !this.config.theme) return;
        const w = this.canvas.width, h = this.canvas.height, s = this.scale || 1, theme = this.config.theme;
        const bg = theme.background || '#000';
        if (bg.includes('gradient')) {
             const grd = ctx.createLinearGradient(0, 0, 0, h);
             const colors = bg.match(/#[a-fA-F0-9]{6}/g);
             if (colors && colors.length >= 2) { grd.addColorStop(0, colors[0]); grd.addColorStop(1, colors[1]); ctx.fillStyle = grd; } else ctx.fillStyle = '#000';
        } else ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        if (this.config.gameType === 'MAZE' && this.walls) { ctx.fillStyle = theme.accentColor || '#00f'; this.walls.forEach(wall => ctx.fillRect(wall.x, wall.y, wall.w, wall.h)); }
        if (this.config.gameType === 'MAZE' && this.dots) { ctx.fillStyle = theme.accentColor || '#ff0'; this.dots.forEach(dot => { ctx.beginPath(); ctx.arc(dot.x + dot.w/2, dot.y + dot.h/2, dot.w/2, 0, Math.PI * 2); ctx.fill(); }); }
        if (this.config.gameType === 'SHOOTER' && this.bullets) { ctx.fillStyle = '#ff0'; this.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h)); }
        if (this.config.gameType === 'JUMP' && this.platforms) { ctx.fillStyle = theme.obstacleColor; this.platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h)); }
        if (this.config.gameType === 'PUZZLE' && this.puzzleGrid) {
            const gemColors = [theme.playerColor, theme.obstacleColor, theme.accentColor, '#fff', '#f0f'];
            this.puzzleGrid.forEach(gem => {
                ctx.fillStyle = gemColors[gem.type] || '#fff';
                ctx.fillRect(gem.x + 2, gem.y + 2, gem.w - 4, gem.h - 4);
                if (this.selectedGem === gem) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(gem.x+2, gem.y+2, gem.w-4, gem.h-4); }
            });
        }
        if (this.config.gameType === 'STACK') { ctx.fillStyle = theme.playerColor; this.stackBlocks.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h)); ctx.fillStyle = theme.accentColor; ctx.fillRect(this.currentStackBlock.x, this.currentStackBlock.y, this.currentStackBlock.w, this.currentStackBlock.h); }

        this.drawBackgroundParticles(ctx, w, h, s);
        const pColor = theme.playerColor || '#fff', oColor = theme.obstacleColor || '#f00', aColor = theme.accentColor || '#0ff';
        if (this.trail) {
            this.trail.forEach((pos, i) => { const alpha = (5 - i) / 10; ctx.globalAlpha = alpha; if (this.config.sprites && this.config.sprites.player) this.drawSprite(this.config.sprites.player, pos.x, pos.y, this.player.w, this.player.h, pColor, 0); else { ctx.fillStyle = pColor; ctx.fillRect(pos.x, pos.y, this.player.w, this.player.h); } });
            ctx.globalAlpha = 1;
        }
        if (!['FLAPPY', 'MAZE', 'PUZZLE', 'STACK'].includes(this.config.gameType)) {
            ctx.strokeStyle = aColor; ctx.lineWidth = Math.max(1, 2 * s); ctx.beginPath(); ctx.moveTo(0, this.groundY); ctx.lineTo(w, this.groundY);
            if (this.config.gameType === 'GRAVITY') { ctx.moveTo(0, this.topY); ctx.lineTo(w, this.topY); }
            ctx.stroke();
        }
        if (!['PUZZLE', 'STACK'].includes(this.config.gameType)) {
            ctx.fillStyle = pColor;
            if (this.config.sprites && this.config.sprites.player) this.drawSprite(this.config.sprites.player, this.player.x, this.player.y, this.player.w, this.player.h, pColor, 0); else ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        }
        this.obstacles.forEach(obs => {
            const rotation = (obs.type === 'ZIGZAG' || obs.type === 'NORMAL') ? this.frame / 20 : 0;
            if (this.config.sprites && this.config.sprites.obstacle && obs.type !== 'PIPE') this.drawSprite(this.config.sprites.obstacle, obs.x, obs.y, obs.w, obs.h, oColor, rotation); else { ctx.fillStyle = oColor; ctx.fillRect(obs.x, obs.y, obs.w, obs.h); }
        });
        ctx.fillStyle = aColor; ctx.font = `${Math.floor(12 * s)}px Courier New`; ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${this.score}`, 10 * s, 20 * s); ctx.fillText(`DIFF: ${this.difficulty.toFixed(1)}x`, 10 * s, 35 * s);
        if (this.isGameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `${Math.floor(20 * s)}px Courier New`;
            ctx.fillText("GAME OVER", w/2, h/2); ctx.font = `${Math.floor(10 * s)}px Courier New`; ctx.fillText("Click to Restart", w/2, h/2 + 30 * s); ctx.textAlign = 'left';
        }
    }

    drawBackgroundParticles(ctx, w, h, s) {
        if (!this.config || !this.config.category) return;
        const category = this.config.category, seed = this.config.seed || 0;
        ctx.fillStyle = this.config.theme.accentColor || '#fff'; ctx.globalAlpha = 0.3;
        for (let i = 0; i < 15; i++) {
            const px = (Math.sin(seed + i * 100 + this.frame * 0.05) * 0.5 + 0.5) * w, py = (Math.cos(seed + i * 200 + this.frame * 0.02) * 0.5 + 0.5) * h;
            if (category === 'SPACE') { const size = (Math.sin(this.frame * 0.1 + i) * 1 + 2) * s; ctx.fillRect(px, py, size, size); }
            else if (category === 'WATER') { const ry = (py + this.frame * 0.5) % h; ctx.beginPath(); ctx.arc(px, ry, 3 * s, 0, Math.PI * 2); ctx.fill(); }
            else if (category === 'AIR') { const rx = (px - this.frame * 0.3) % w; ctx.fillRect(rx < 0 ? rx + w : rx, py, 20 * s, 10 * s); }
            else if (category === 'URBAN') { const ry = (py + this.frame * 2) % h; ctx.fillRect(px, ry, 1 * s, 10 * s); }
            else if (category === 'CYBER') { const ry = (py + this.frame * 1.5) % h; ctx.font = `${10 * s}px monospace`; ctx.fillText(String.fromCharCode(33 + (this.frame + i) % 94), px, ry); }
        }
        ctx.globalAlpha = 1;
    }

    drawSprite(bitmap, x, y, w, h, color, rotation = 0) {
        if (!bitmap) return;
        this.ctx.save(); this.ctx.translate(x + w / 2, y + h / 2); this.ctx.rotate(rotation);
        const cellW = w / 8, cellH = h / 8; this.ctx.fillStyle = color;
        for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { if (bitmap[r * 8 + c] === 1) this.ctx.fillRect(-w/2 + c * cellW, -h/2 + r * cellH, Math.ceil(cellW), Math.ceil(cellH)); } }
        this.ctx.restore();
    }

    gameOver() { this.isPlaying = false; this.isGameOver = true; this.draw(); }

    loop() { if (this.isPlaying && !this.isGameOver) { this.update(); this.draw(); this.animationFrameId = requestAnimationFrame(() => this.loop()); } }
}
