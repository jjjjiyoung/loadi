document.addEventListener('DOMContentLoaded', () => {
    // 1. Loadi 인스턴스 생성 (설정 옵션)
    const loadi = new Loadi({
        target: '#loading-game-area', // 게임을 주입할 컨테이너 ID
        width: '100%',
        height: 180,
        theme: {
            background: '#1a1a1a',
            primary: '#bb86fc', // Accent Color와 매칭
            secondary: '#03dac6' // 보조 컬러
        },
        autoProgress: false, // 수동으로 로딩 상태를 제어하기 위해 false 설정
        onComplete: () => {
            console.log('Loading logic finished.');
        }
    });

    // 게임 시작
    loadi.start();

    // 2. 가상의 "무거운 로딩" 시뮬레이션
    const statusText = document.querySelector('.hero-section p');
    const pctSpan = document.getElementById('pct');
    let loadPercent = 0;
    let simulationId = null;

    function runSimulation() {
        if (loadPercent < 100) {
            // 랜덤한 속도로 로딩 진행 (네트워크 지연 시뮬레이션)
            const increment = Math.random() * 1.5; 
            loadPercent += increment;
            
            if (loadPercent > 100) loadPercent = 100;
            
            // UI 업데이트
            pctSpan.innerText = Math.floor(loadPercent) + '%';
            
            // Loadi 라이브러리에 진행률 전달
            loadi.updateProgress(loadPercent);

            // 로딩 메시지 변경 (재미 요소)
            if (loadPercent > 30 && loadPercent < 31) statusText.innerText = "Downloading assets...";
            if (loadPercent > 60 && loadPercent < 61) statusText.innerText = "Compiling shaders...";
            if (loadPercent > 90 && loadPercent < 91) statusText.innerText = "Finalizing UI...";

            simulationId = requestAnimationFrame(runSimulation);
        } else {
            // 로딩 완료 처리
            finishLoading();
        }
    }

    function finishLoading() {
        statusText.innerText = "Connection Established.";
        pctSpan.innerText = "100%";
        loadi.updateProgress(100);
        
        // 잠시 후 게임 정지 (사용자가 완료 메시지를 볼 시간 부여)
        setTimeout(() => {
            loadi.stop();
            // 실제 앱에서는 여기서 메인 화면으로 전환됩니다.
            alert("로딩 완료! 메인 앱으로 진입합니다.");
        }, 500);
    }

    // 시뮬레이션 시작
    runSimulation();

    // "Simulate Reload" 버튼 핸들러
    document.getElementById('btn-simulate').addEventListener('click', () => {
        // 상태 초기화
        cancelAnimationFrame(simulationId);
        loadPercent = 0;
        statusText.innerText = "Establishing secure connection...";
        
        // Loadi 초기화 및 재시작
        loadi.reset();
        loadi.start();
        
        // 시뮬레이션 재시작
        runSimulation();
    });
});
