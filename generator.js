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
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // Pseudo-random number generator based on seed
    function seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    function generatePalette(seed) {
        const hue1 = Math.floor(seededRandom(seed) * 360);
        const hue2 = (hue1 + 180) % 360; // Complementary
        const hue3 = (hue1 + 40) % 360;  // Analogous

        return {
            background: `hsl(${hue1}, 20%, 10%)`,
            playerColor: `hsl(${hue3}, 80%, 60%)`,
            obstacleColor: `hsl(${hue2}, 70%, 50%)`,
            accentColor: `hsl(${hue3}, 100%, 70%)`
        };
    }

    function generateSprite(seed) {
        // More sophisticated 8x8 pixel icon generator
        // Structure: 0-2 (Top/Head), 3-5 (Middle/Body), 6-7 (Bottom/Legs)
        const grid = new Array(64).fill(0);
        
        const getVal = (s, prob) => seededRandom(s) > prob ? 1 : 0;

        for (let y = 0; y < 8; y++) {
            let prob = 0.5;
            if (y < 2) prob = 0.6; // Head part (tends to be narrower)
            if (y >= 2 && y <= 5) prob = 0.3; // Body part (thicker)
            if (y > 5) prob = 0.7; // Legs (sparse)

            for (let x = 1; x < 4; x++) { // Center 6 columns (1 to 6)
                const val = getVal(seed + y * 13 + x, prob);
                grid[y * 8 + x] = val;
                grid[y * 8 + (7 - x)] = val; // Symmetrical
            }
        }
        
        // Ensure some core pixels are always there (the "soul" of the icon)
        grid[3 * 8 + 3] = 1; grid[3 * 8 + 4] = 1;
        grid[4 * 8 + 3] = 1; grid[4 * 8 + 4] = 1;
        
        return grid;
    }

    function generateGameConfig(keyword) {
        const seed = stringToSeed(keyword);
        const palette = generatePalette(seed);
        
        return {
            keyword: keyword,
            seed: seed,
            theme: palette,
            sprites: {
                player: generateSprite(seed + 500),
                obstacle: generateSprite(seed + 999)
            },
            autoPlay: true 
        };
    }

    // --- UI Interactions ---

    btnGenerate.addEventListener('click', () => {
        const keyword = keywordInput.value.trim();
        if (!keyword) return;

        previewStatus.innerText = "GENERATING ICONIC ASSETS...";
        previewStatus.style.color = "#ffbd2e";
        
        setTimeout(() => {
            currentConfig = generateGameConfig(keyword);
            statTheme.innerText = currentConfig.theme.accentColor;
            statTheme.style.color = currentConfig.theme.accentColor;
            statHash.innerText = `0x${currentConfig.seed.toString(16).toUpperCase()}`;
            
            engineInstance = new LoadiEngine('game-container', currentConfig);
            
            // Interaction Listener to disable Auto-pilot
            const disableAuto = () => {
                if (engineInstance.config.autoPlay) {
                    engineInstance.config.autoPlay = false;
                    previewStatus.innerText = "MANUAL CONTROL ACTIVE";
                    previewStatus.style.color = "#00f2ff";
                }
            };

            window.addEventListener('keydown', (e) => { if(e.code === 'Space') disableAuto(); }, {once: true});
            document.getElementById('game-container').addEventListener('mousedown', disableAuto, {once: true});

            previewStatus.innerText = "SYSTEM ACTIVE - AUTO PILOT";
            previewStatus.style.color = "#27c93f";
            controls.classList.remove('hidden');

        }, 800);
    });

    btnDownload.addEventListener('click', () => {
        if (!currentConfig) return;
        createZipPackage(currentConfig);
    });

    // --- ZIP Packaging ---

    async function createZipPackage(config) {
        const zip = new JSZip();
        
        // 1. Get Engine Code
        const response = await fetch('loadi-engine.js');
        const engineCode = await response.text();

        // 2. Create Config File
        // Remove autoPlay for the production version
        const prodConfig = JSON.parse(JSON.stringify(config));
        prodConfig.autoPlay = false;
        
        const configCode = `
            // Generated by Loadi Gen
            // Keyword: ${config.keyword}
            window.loadiConfig = ${JSON.stringify(prodConfig, null, 4)};
        `;

        // 3. Create HTML Wrapper
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Loadi Game: ${config.keyword}</title>
    <style>
        body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #111; }
        #game-target { width: 100%; max-width: 600px; height: 200px; border: 2px solid ${config.theme.accentColor}; }
    </style>
</head>
<body>
    <div id="game-target"></div>
    
    <script>${configCode}</script>
    <script>${engineCode}</script>
    <script>
        // Initialize Game
        new LoadiEngine('game-target', window.loadiConfig);
    </script>
</body>
</html>
        `;

        zip.file("index.html", htmlContent);
        zip.file("loadi-engine.js", engineCode);
        zip.file("config.js", configCode);

        // Generate Blob
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `loadi-${config.keyword.toLowerCase()}.zip`);
    }

    // Allow Enter key
    keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') btnGenerate.click();
    });
});
