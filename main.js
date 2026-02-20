const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startMsg = document.getElementById('start-msg');
const progressFill = document.getElementById('progress-fill');

canvas.width = 400;
canvas.height = 150;

let isPlaying = false;
let score = 0;
let loadingPercent = 0;

// 캐릭터 설정 (참새 컨셉)
const player = {
    x: 50,
    y: 110,
    width: 20,
    height: 20,
    color: '#ffcc00', // 참새 부리/몸통 컬러
    dy: 0,
    jumpForce: 7,
    gravity: 0.4,
    grounded: false
};

const obstacles = [];
let frame = 0;

function drawPlayer() {
    // 몸통
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    // 눈 (픽셀 하나 포인트)
    ctx.fillStyle = "#000";
    ctx.fillRect(player.x + 14, player.y + 4, 3, 3);
}

function createObstacle() {
    if (frame % 100 === 0) {
        obstacles.push({
            x: canvas.width,
            y: 110,
            width: 15,
            height: 20,
            color: '#33ff33'
        });
    }
}

function update() {
    if (!isPlaying) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 중력 및 점프
    player.dy += player.gravity;
    player.y += player.dy;

    if (player.y > 110) {
        player.y = 110;
        player.dy = 0;
        player.grounded = true;
    }

    drawPlayer();

    // 장애물 처리
    obstacles.forEach((obs, index) => {
        obs.x -= 4;
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // 충돌 체크
        if (player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y) {
            resetGame();
        }

        if (obs.x + obs.width < 0) obstacles.splice(index, 1);
    });

    // 가짜 로딩 진행률 업데이트
    if (loadingPercent < 100) {
        loadingPercent += 0.05;
        progressFill.style.width = loadingPercent + "%";
    }

    frame++;
    requestAnimationFrame(update);
}

function resetGame() {
    isPlaying = false;
    startMsg.style.display = 'block';
    obstacles.length = 0;
    loadingPercent = 0;
    score = 0;
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (!isPlaying) {
            isPlaying = true;
            startMsg.style.display = 'none';
            update();
        } else if (player.grounded) {
            player.dy = -player.jumpForce;
            player.grounded = false;
        }
    }
});

// 초기화면
ctx.fillStyle = "#081008";
ctx.fillRect(0, 0, canvas.width, canvas.height);