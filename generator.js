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
        
        const flightTerms = ['bird', 'fly', 'wing', 'sky', 'cloud', 'plane', 'bee', 'dragon', 'angel', 'butterfly', '새', '비행', '날개', '하늘', '구름'];
        const spaceTerms = ['space', 'mars', 'star', 'moon', 'rocket', 'alien', 'galaxy', 'meteor', 'ufo', 'planet', 'cosmic', '우주', '화성', '별', '달', '로켓', '외계인'];
        const waterTerms = ['fish', 'sea', 'ocean', 'water', 'shark', 'whale', 'swim', 'bubble', 'dive', '물고기', '바다', '물', '상어', '수영'];

        if (flightTerms.some(t => kw.includes(t))) return 'AIR';
        if (spaceTerms.some(t => kw.includes(t))) return 'SPACE';
        if (waterTerms.some(t => kw.includes(t))) return 'WATER';
        
        const categories = ['LAND', 'AIR', 'SPACE', 'WATER'];
        return categories[stringToSeed(kw) % categories.length];
    }

    function getThemeByContext(category, seed) {
        const hue = Math.floor(seededRandom(seed) * 360);
        
        switch(category) {
            case 'AIR':
                return {
                    background: 'linear-gradient(to bottom, #1e3c72, #2a5298)',
                    playerColor: '#fff',
                    obstacleColor: '#f1c40f',
                    accentColor: '#00f2ff',
                    gameType: 'FLAPPY'
                };
            case 'SPACE':
                return {
                    background: '#050505',
                    playerColor: '#00f2ff',
                    obstacleColor: '#e74c3c',
                    accentColor: '#9b59b6',
                    gameType: 'DODGE'
                };
            case 'WATER':
                return {
                    background: '#002b36',
                    playerColor: '#268bd2',
                    obstacleColor: '#2aa198',
                    accentColor: '#859900',
                    gameType: 'FLAPPY'
                };
            default: // LAND
                return {
                    background: `hsl(${hue}, 20%, 10%)`,
                    playerColor: `hsl(${(hue + 40) % 360}, 80%, 60%)`,
                    obstacleColor: `hsl(${(hue + 180) % 360}, 70%, 50%)`,
                    accentColor: `hsl(${(hue + 40) % 360}, 100%, 70%)`,
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
                    if (category === 'SPACE') {
                        prob = (x < 2 && y > 1 && y < 7) ? 0.2 : 0.8;
                        if (y === 1 && x === 1) prob = 0.1;
                    } else if (category === 'AIR' || category === 'WATER') {
                        prob = (y > 2 && y < 6) ? 0.2 : 0.7;
                        if (x > 1) prob -= 0.2;
                    }
                } else {
                    if (category === 'SPACE') prob = 0.4;
                    else prob = 0.3;
                }
                const val = rand(seed + y * 13 + x) > prob ? 1 : 0;
                grid[y * 8 + x] = val;
                grid[y * 8 + (7 - x)] = val;
            }
        }
        if (isPlayer) {
            grid[3 * 8 + 3] = 1; grid[3 * 8 + 4] = 1;
            grid[4 * 8 + 3] = 1; grid[4 * 8 + 4] = 1;
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
        const keyword = keywordInput.value.trim();
        if (!keyword) return;

        // Cleanup previous instance
        if (engineInstance) {
            engineInstance.destroy();
            engineInstance = null;
        }

        previewStatus.innerText = "INITIALIZING SYSTEM...";
        previewStatus.style.color = "#ffbd2e";
        
        try {
            // Give UI a tiny moment to update status
            await new Promise(r => setTimeout(r, 50));
            
            previewStatus.innerText = "MAPPING KEYWORD CONTEXT...";
            currentConfig = generateGameConfig(keyword);
            
            statTheme.innerText = currentConfig.category;
            statTheme.style.color = currentConfig.theme.accentColor;
            statHash.innerText = `0x${currentConfig.seed.toString(16).toUpperCase()}`;
            
            previewStatus.innerText = "SPAWNING ENGINE...";
            engineInstance = new LoadiEngine('game-container', currentConfig);
            
            const disableAuto = () => {
                if (engineInstance && engineInstance.config.autoPlay) {
                    engineInstance.config.autoPlay = false;
                    previewStatus.innerText = "MANUAL CONTROL ACTIVE";
                    previewStatus.style.color = "#00f2ff";
                }
            };

            window.addEventListener('keydown', (e) => { if(e.code === 'Space') disableAuto(); }, {once: true});
            document.getElementById('game-container').addEventListener('mousedown', disableAuto, {once: true});

            previewStatus.innerText = `SYSTEM ACTIVE - ${currentConfig.gameType} MODE`;
            previewStatus.style.color = "#27c93f";
            controls.classList.remove('hidden');
        } catch (error) {
            console.error("Generation Error:", error);
            previewStatus.innerText = "CORE SYSTEM ERROR - RETRYING...";
            previewStatus.style.color = "#ff5f56";
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
