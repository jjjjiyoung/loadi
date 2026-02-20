document.addEventListener('DOMContentLoaded', () => {
    const keywordInput = document.getElementById('keyword-input');
    const btnGenerate = document.getElementById('btn-generate');
    const btnDownload = document.getElementById('btn-download');
    const previewStatus = document.getElementById('preview-status');
    const controls = document.getElementById('action-controls');
    const statTheme = document.getElementById('stat-theme');
    const statHash = document.getElementById('stat-hash');

    let currentConfig = null;
    let engineInstance = null;

    // --- Core Generator Logic ---

    function stringToSeed(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    function seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    function analyzeKeyword(keyword) {
        const kw = keyword.toLowerCase();
        
        const themes = {
            AIR: ['bird', 'fly', 'wing', 'sky', 'cloud', 'plane', 'bee', 'dragon', 'angel', 'butterfly', '새', '비행', '날개', '하늘', '구름'],
            SPACE: ['space', 'mars', 'star', 'moon', 'rocket', 'alien', 'galaxy', 'meteor', 'ufo', 'planet', 'cosmic', '우주', '화성', '별', '달', '로켓', '외계인'],
            WATER: ['fish', 'sea', 'ocean', 'water', 'shark', 'whale', 'swim', 'bubble', 'dive', '물고기', '바다', '물', '상어', '수영'],
            NATURE: ['forest', 'tree', 'grass', 'leaf', 'flower', 'bug', 'jungle', 'animal', '숲', '나무', '풀', '꽃', '동물'],
            CYBER: ['cyber', 'neon', 'matrix', 'glitch', 'robot', 'tech', 'digital', 'code', 'future', '네온', '로봇', '기술', '디지털'],
            FIRE: ['fire', 'flame', 'lava', 'volcano', 'hot', 'burn', 'sun', 'dragon', '불', '화염', '용암', '화산', '태양'],
            URBAN: ['city', 'street', 'car', 'building', 'traffic', 'urban', 'road', '도시', '도로', '빌딩', '자동차'],
            MAZE: ['pacman', 'maze', 'ghost', 'dot', 'eat', 'cookie', 'pixel', 'retro', '팩맨', '미로', '유령', '복고']
        };

        for (const [theme, words] of Object.entries(themes)) {
            if (words.some(t => kw.includes(t))) return theme;
        }
        
        const categories = Object.keys(themes);
        return categories[stringToSeed(kw) % categories.length];
    }

    function getThemeByContext(category, seed) {
        const hue = Math.floor(seededRandom(seed) * 360);
        
        switch(category) {
            case 'MAZE':
                return {
                    background: '#000000',
                    playerColor: '#ffff00', obstacleColor: '#ff00ff', accentColor: '#0000ff',
                    gameType: 'MAZE'
                };
            case 'AIR':
                return {
                    background: 'linear-gradient(to bottom, #4facfe, #00f2fe)',
                    playerColor: '#ffffff', obstacleColor: '#f1c40f', accentColor: '#ffffff',
                    gameType: 'FLAPPY'
                };
            case 'SPACE':
                return {
                    background: '#050505',
                    playerColor: '#00f2ff', obstacleColor: '#ff0055', accentColor: '#9b59b6',
                    gameType: 'DODGE'
                };
            case 'WATER':
                return {
                    background: 'linear-gradient(to bottom, #001f3f, #0074d9)',
                    playerColor: '#7fdbff', obstacleColor: '#39cccc', accentColor: '#ffffff',
                    gameType: 'FLAPPY'
                };
            case 'NATURE':
                return {
                    background: 'linear-gradient(to bottom, #11998e, #38ef7d)',
                    playerColor: '#ffffff', obstacleColor: '#795548', accentColor: '#ffffff',
                    gameType: 'RUNNER'
                };
            case 'CYBER':
                return {
                    background: '#000000',
                    playerColor: '#00ff00', obstacleColor: '#ff00ff', accentColor: '#00ffff',
                    gameType: 'RUNNER'
                };
            case 'FIRE':
                return {
                    background: 'linear-gradient(to top, #870000, #190a05)',
                    playerColor: '#ffcc00', obstacleColor: '#ff4400', accentColor: '#ffffff',
                    gameType: 'DODGE'
                };
            case 'URBAN':
                return {
                    background: '#2c3e50',
                    playerColor: '#ecf0f1', obstacleColor: '#e74c3c', accentColor: '#f1c40f',
                    gameType: 'RUNNER'
                };
            default:
                return {
                    background: '#111111',
                    playerColor: '#ffffff', obstacleColor: '#ff0000', accentColor: '#00ffff',
                    gameType: 'RUNNER'
                };
        }
    }

    function generateSprite(seed, category, isPlayer = true) {
        const grid = new Array(64).fill(0);
        const rand = (s) => seededRandom(s);
        
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 4; x++) {
                let prob = 0.5;
                
                if (isPlayer) {
                    switch(category) {
                        case 'SPACE': // Pointy Rocket
                            prob = (y < 2 && x === 3) ? 0.9 : (y > 1 && y < 7 && x > 1) ? 0.2 : 0.8;
                            break;
                        case 'AIR': // Wide Winged Bird
                            prob = (y > 2 && y < 6) ? 0.2 : (x < 2) ? 0.9 : 0.7;
                            break;
                        case 'WATER': // Fish with tail
                            prob = (y > 2 && y < 6 && x > 0) ? 0.2 : (x === 0 && y > 3 && y < 5) ? 0.3 : 0.9;
                            break;
                        case 'CYBER': // Geometric Robot
                            prob = (x > 1 && y > 1 && y < 7) ? 0.2 : 0.8;
                            if ((x + y) % 3 === 0) prob -= 0.3;
                            break;
                        case 'FIRE': // Flickering Flame
                            prob = (y < 3) ? 0.9 : (y > 2 && x > 1) ? 0.2 : 0.7;
                            break;
                        case 'NATURE': // Organic Animal
                            prob = (y > 1 && y < 7 && x > 0) ? 0.3 : 0.8;
                            break;
                        case 'URBAN': // Boxy Vehicle
                            prob = (y > 2 && y < 6) ? 0.2 : 0.9;
                            break;
                        case 'MAZE': // Pac-man Mouth
                            prob = (x > 1 && !(x > 4 && y > 2 && y < 6)) ? 0.1 : 0.8;
                            break;
                    }
                } else {
                    // Specialized Obstacles per Theme
                    switch(category) {
                        case 'MAZE': // Ghost shape
                            prob = (y > 1 && x > 0) ? 0.2 : 0.8;
                            if (y > 6 && (x === 1 || x === 3)) prob = 0.9;
                            break;
                        case 'SPACE': // Jagged Meteor
                            prob = (x > 0 && y > 0 && x < 4 && y < 7) ? 0.3 : 0.9;
                            break;
                        case 'NATURE': // Round Rock / Bush
                            prob = (y > 3 && x > 0) ? 0.2 : 0.8;
                            break;
                        case 'URBAN': // Rectangular Building
                            prob = (x > 1) ? 0.1 : 0.9;
                            break;
                        case 'WATER': // Spike Mine
                            prob = (x === 3 || y === 4) ? 0.2 : 0.8;
                            break;
                        default:
                            prob = 0.4;
                    }
                }

                if (rand(seed + y * 13 + x) > prob) {
                    grid[y * 8 + x] = 1;
                    grid[y * 8 + (7 - x)] = 1; // Symmetrical
                }
            }
        }
        return grid;
    }

    function generateGameConfig(keyword) {
        const seed = stringToSeed(keyword);
        const category = analyzeKeyword(keyword);
        const theme = getThemeByContext(category, seed);
        
        return {
            keyword: keyword,
            seed: seed,
            category: category,
            theme: {
                background: theme.background,
                playerColor: theme.playerColor,
                obstacleColor: theme.obstacleColor,
                accentColor: theme.accentColor
            },
            gameType: theme.gameType,
            sprites: {
                player: generateSprite(seed + 500, category, true),
                obstacle: generateSprite(seed + 999, category, false)
            },
            autoPlay: true 
        };
    }

    // --- UI Interactions ---

    btnGenerate.addEventListener('click', async () => {
        const keyword = (keywordInput.value || "").trim();
        if (!keyword) return;

        // Cleanup previous instance
        if (engineInstance) {
            try {
                engineInstance.destroy();
            } catch (e) {
                console.warn("Cleanup warning:", e);
            }
            engineInstance = null;
        }

        if (previewStatus) {
            previewStatus.innerText = "INITIALIZING SYSTEM...";
            previewStatus.style.color = "#ffbd2e";
        }
        
        try {
            // Give UI a tiny moment to update status
            await new Promise(r => setTimeout(r, 100));
            
            if (previewStatus) previewStatus.innerText = "MAPPING KEYWORD CONTEXT...";
            currentConfig = generateGameConfig(keyword);
            
            if (statTheme) {
                statTheme.innerText = currentConfig.category || "LAND";
                statTheme.style.color = currentConfig.theme.accentColor;
            }
            if (statHash) {
                statHash.innerText = `0x${(currentConfig.seed || 0).toString(16).toUpperCase()}`;
            }
            
            if (previewStatus) previewStatus.innerText = "SPAWNING ENGINE...";
            
            // Critical check for container existence
            const container = document.getElementById('game-container');
            if (!container) throw new Error("Game container not found");

            engineInstance = new LoadiEngine('game-container', currentConfig);
            
            const disableAuto = () => {
                if (engineInstance && engineInstance.config.autoPlay) {
                    engineInstance.config.autoPlay = false;
                    if (previewStatus) {
                        previewStatus.innerText = "MANUAL CONTROL ACTIVE";
                        previewStatus.style.color = "#00f2ff";
                    }
                }
            };

            const gameContainer = document.getElementById('game-container');
            window.addEventListener('keydown', (e) => { if(e.code === 'Space') disableAuto(); }, {once: true});
            if (gameContainer) gameContainer.addEventListener('mousedown', disableAuto, {once: true});

            if (previewStatus) {
                previewStatus.innerText = `SYSTEM ACTIVE - ${currentConfig.gameType} MODE`;
                previewStatus.style.color = "#27c93f";
            }
            if (controls) controls.classList.remove('hidden');
        } catch (error) {
            console.error("Loadi Generation Error Details:", error);
            if (previewStatus) {
                previewStatus.innerText = "SYSTEM ERROR - SEE CONSOLE";
                previewStatus.style.color = "#ff5f56";
            }
        }
    });

    btnDownload.addEventListener('click', () => {
        if (!currentConfig) return;
        createZipPackage(currentConfig);
    });

    async function createZipPackage(config) {
        const zip = new JSZip();
        const response = await fetch('loadi-engine.js');
        const engineCode = await response.text();

        const prodConfig = JSON.parse(JSON.stringify(config));
        prodConfig.autoPlay = false;
        
        const configCode = `
            // Generated by Loadi Gen
            // Keyword: ${config.keyword}
            window.loadiConfig = ${JSON.stringify(prodConfig, null, 4)};
        `;

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Loadi Game: ${config.keyword}</title>
    <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: ${config.theme.background.includes('gradient') ? '#000' : config.theme.background}; overflow: hidden; }
        #game-target { width: 100vw; height: 100vh; background: ${config.theme.background}; }
    </style>
</head>
<body>
    <div id="game-target"></div>
    <script>${configCode}</script>
    <script>${engineCode}</script>
    <script>new LoadiEngine('game-target', window.loadiConfig);</script>
</body>
</html>
        `;

        zip.file("index.html", htmlContent);
        zip.file("loadi-engine.js", engineCode);
        zip.file("config.js", configCode);

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `loadi-${config.keyword.toLowerCase()}.zip`);
    }

    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnGenerate.click();
    });
});
