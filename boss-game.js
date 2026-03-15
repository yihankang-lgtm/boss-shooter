(function () {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const bossHealthFill = document.getElementById('bossHealthFill');
    const bossHealthText = document.getElementById('bossHealthText');
    const startBtn = document.getElementById('startBtn');
    const gameOverEl = document.getElementById('gameOver');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverMessage = document.getElementById('gameOverMessage');
    const victoryEl = document.getElementById('victory');
    const restartBtn = document.getElementById('restartBtn');
    const victoryRestartBtn = document.getElementById('victoryRestartBtn');

    const BOSS_MAX_HP = 100;
    const BOSS_X = canvas.width / 2;
    const BOSS_Y = 60;
    const BOSS_WIDTH = 120;
    const BOSS_HEIGHT = 70;
    const BOSS_VIEW_WIDTH = 220;
    const PLAYER_SIZE = 28;
    const PLAYER_Y = canvas.height - 50;
    const PLAYER_SPEED = 6;
    const PLAYER_LASER_SPEED = -14;
    const BOSS_LASER_SPEED_P1 = 8;
    const BOSS_LASER_SPEED_P3 = 11;
    const BOSS_LASER_INTERVAL_P1_MIN = 400;
    const BOSS_LASER_INTERVAL_P1_MAX = 900;
    const BOSS_LASER_INTERVAL_P3_MIN = 520;
    const BOSS_LASER_INTERVAL_P3_MAX = 1000;
    const BOSS_BIG_LASER_SCALE = 3;
    const BOSS_BIG_LASER_WIDTH = 6 * BOSS_BIG_LASER_SCALE;
    const BOSS_BIG_LASER_HEIGHT = 24 * BOSS_BIG_LASER_SCALE;
    const BOSS_BIG_LASER_SPEED = 6;
    const BOSS_BIG_LASER_INTERVAL_MIN = 2600;
    const BOSS_BIG_LASER_INTERVAL_MAX = 4200;
    const LASER_WIDTH = 4;
    const LASER_HEIGHT = 20;
    const BOSS_LASER_WIDTH = 6;
    const BOSS_LASER_HEIGHT = 24;
    const PLAYER_DAMAGE = BOSS_MAX_HP * 0.01;
    const MINION_W = 28;
    const MINION_H = 22;
    const MINION_Y = 22;
    const MINION_LASER_SPEED_P2 = 8;
    const MINION_LASER_SPEED_P3 = 9;
    const MINION_SHOOT_INTERVAL_P2 = 1100;
    const MINION_SHOOT_INTERVAL_P3 = 950;
    const MINION_HP = 2;
    const MINION_RESPAWN_INTERVAL_MS = 20000;
    const PLAYER_AUTO_SHOOT_INTERVAL_MS = 350;

    let gameRunning = false;
    let playerX = canvas.width / 2;
    let mouseX = canvas.width / 2;
    let mouseInCanvas = false;
    let keys = {};
    let bossHp = BOSS_MAX_HP;
    let playerLasers = [];
    let bossLasers = [];
    let minions = [];
    let nextBossLaserAt = 0;
    let nextBossBigLaserAt = 0;
    let nextPlayerShotAt = 0;
    let bossShotCount = 0;
    let nextMinionSpawnAt = 0;
    let lastBossPhase = 0;
    let animationId = null;

    function getBossPhase() {
        const pct = (bossHp / BOSS_MAX_HP) * 100;
        if (pct > 70) return 1;
        if (pct > 30) return 2;
        return 3;
    }

    function rectRect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function updateBossHealthBar() {
        const pct = Math.max(0, bossHp / BOSS_MAX_HP * 100);
        bossHealthFill.style.width = pct + '%';
        bossHealthText.textContent = Math.ceil(pct) + '%';
    }

    function spawnBossLaser(aimAtPlayer) {
        const phase = getBossPhase();
        const speed = phase === 3 ? BOSS_LASER_SPEED_P3 : BOSS_LASER_SPEED_P1;
        const x = aimAtPlayer
            ? playerX - BOSS_LASER_WIDTH / 2
            : BOSS_X - BOSS_LASER_WIDTH / 2 + (Math.random() - 0.5) * 80;
        bossLasers.push({
            x,
            y: BOSS_Y + BOSS_HEIGHT / 2,
            w: BOSS_LASER_WIDTH,
            h: BOSS_LASER_HEIGHT,
            vy: speed
        });
    }

    function spawnBossBigLaser() {
        bossLasers.push({
            x: BOSS_X - BOSS_BIG_LASER_WIDTH / 2,
            y: BOSS_Y + BOSS_HEIGHT / 2,
            w: BOSS_BIG_LASER_WIDTH,
            h: BOSS_BIG_LASER_HEIGHT,
            vy: BOSS_BIG_LASER_SPEED
        });
    }

    function spawnInitialMinionsForPhase(phase) {
        if (minions.length >= 4) return;
        const want = phase === 2 ? 2 : 4;
        if (minions.length >= want) return;
        const positions = phase === 2
            ? [canvas.width * 0.28, canvas.width * 0.72]
            : [canvas.width * 0.18, canvas.width * 0.42, canvas.width * 0.58, canvas.width * 0.82];
        const now = performance.now();
        for (let i = minions.length; i < want; i++) {
            minions.push({
                x: positions[i] - MINION_W / 2,
                y: MINION_Y,
                w: MINION_W,
                h: MINION_H,
                hp: MINION_HP,
                nextShotAt: now + 400 + i * 200
            });
        }
    }

    function spawnOneMinion() {
        if (minions.length >= 4) return;
        const now = performance.now();
        const margin = 60;
        const x = margin + Math.random() * (canvas.width - 2 * margin - MINION_W);
        minions.push({
            x,
            y: MINION_Y,
            w: MINION_W,
            h: MINION_H,
            hp: MINION_HP,
            nextShotAt: now + 500
        });
    }

    function spawnMinionLaser(m) {
        const phase = getBossPhase();
        const speed = phase === 3 ? MINION_LASER_SPEED_P3 : MINION_LASER_SPEED_P2;
        bossLasers.push({
            x: m.x + m.w / 2 - BOSS_LASER_WIDTH / 2,
            y: m.y + m.h,
            w: BOSS_LASER_WIDTH,
            h: BOSS_LASER_HEIGHT,
            vy: speed
        });
    }

    function shootPlayerLaser() {
        if (!gameRunning) return;
        playerLasers.push({
            x: playerX - LASER_WIDTH / 2,
            y: PLAYER_Y - 5,
            w: LASER_WIDTH,
            h: LASER_HEIGHT,
            vy: PLAYER_LASER_SPEED
        });
    }

    function gameOver() {
        gameRunning = false;
        if (animationId) cancelAnimationFrame(animationId);
        gameOverEl.style.display = 'flex';
        gameOverTitle.textContent = 'Game Over!';
        gameOverMessage.textContent = 'The boss got you.';
    }

    function victory() {
        gameRunning = false;
        if (animationId) cancelAnimationFrame(animationId);
        victoryEl.style.display = 'flex';
    }

    function runGame() {
        const now = performance.now();

        if (keys['ArrowLeft'] || keys['a'] || keys['A']) playerX -= PLAYER_SPEED;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) playerX += PLAYER_SPEED;
        playerX = Math.max(PLAYER_SIZE / 2, Math.min(canvas.width - PLAYER_SIZE / 2, playerX));
        if (gameRunning) {
            const follow = 0.12;
            const useKeys = keys['ArrowLeft'] || keys['ArrowRight'] || keys['a'] || keys['d'] || keys['A'] || keys['D'];
            const targetX = useKeys ? playerX : (mouseInCanvas ? mouseX : playerX);
            playerX += (targetX - playerX) * follow;
            playerX = Math.max(PLAYER_SIZE / 2, Math.min(canvas.width - PLAYER_SIZE / 2, playerX));
        }

        if (gameRunning && now >= nextPlayerShotAt) {
            shootPlayerLaser();
            nextPlayerShotAt = now + PLAYER_AUTO_SHOOT_INTERVAL_MS;
        }

        const phase = getBossPhase();
        const intervalMin = phase === 3 ? BOSS_LASER_INTERVAL_P3_MIN : BOSS_LASER_INTERVAL_P1_MIN;
        const intervalMax = phase === 3 ? BOSS_LASER_INTERVAL_P3_MAX : BOSS_LASER_INTERVAL_P1_MAX;
        if (now >= nextBossLaserAt && gameRunning) {
            bossShotCount += 1;
            const inBossView = Math.abs(playerX - BOSS_X) <= BOSS_VIEW_WIDTH / 2;
            const aimAtPlayer = bossShotCount % 5 === 0 && inBossView;
            spawnBossLaser(aimAtPlayer);
            nextBossLaserAt = now + intervalMin + Math.random() * (intervalMax - intervalMin);
        }
        if (phase === 3 && gameRunning && now >= nextBossBigLaserAt) {
            spawnBossBigLaser();
            nextBossBigLaserAt = now + BOSS_BIG_LASER_INTERVAL_MIN + Math.random() * (BOSS_BIG_LASER_INTERVAL_MAX - BOSS_BIG_LASER_INTERVAL_MIN);
        }

        if (phase >= 2 && phase !== lastBossPhase) {
            spawnInitialMinionsForPhase(phase);
        }
        lastBossPhase = phase;
        if (phase >= 2 && minions.length < 4 && now >= nextMinionSpawnAt) {
            spawnOneMinion();
            nextMinionSpawnAt = now + MINION_RESPAWN_INTERVAL_MS;
        }
        const minionInterval = phase === 3 ? MINION_SHOOT_INTERVAL_P3 : MINION_SHOOT_INTERVAL_P2;
        for (const m of minions) {
            if (now >= m.nextShotAt) {
                spawnMinionLaser(m);
                m.nextShotAt = now + minionInterval;
            }
        }

        for (let i = playerLasers.length - 1; i >= 0; i--) {
            const l = playerLasers[i];
            l.y += l.vy;
            if (l.y + l.h < 0) {
                playerLasers.splice(i, 1);
                continue;
            }
            let hit = false;
            const travel = Math.abs(l.vy);
            for (let j = minions.length - 1; j >= 0 && !hit; j--) {
                const m = minions[j];
                const my = m.y - travel;
                const mh = m.h + travel;
                if (rectRect(l.x, l.y, l.w, l.h, m.x, my, m.w, mh)) {
                    m.hp -= PLAYER_DAMAGE;
                    if (m.hp <= 0) minions.splice(j, 1);
                    hit = true;
                }
            }
            if (!hit && rectRect(l.x, l.y, l.w, l.h, BOSS_X - BOSS_WIDTH / 2, BOSS_Y - BOSS_HEIGHT / 2, BOSS_WIDTH, BOSS_HEIGHT)) {
                bossHp -= PLAYER_DAMAGE;
                updateBossHealthBar();
                hit = true;
                if (bossHp <= 0) {
                    victory();
                    return;
                }
            }
            if (hit) playerLasers.splice(i, 1);
        }

        for (let i = bossLasers.length - 1; i >= 0; i--) {
            const l = bossLasers[i];
            l.y += l.vy;
            if (l.y > canvas.height) {
                bossLasers.splice(i, 1);
                continue;
            }
            if (rectRect(l.x, l.y, l.w, l.h, playerX - PLAYER_SIZE / 2, PLAYER_Y - PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE)) {
                gameOver();
                return;
            }
        }

        draw();
        if (gameRunning) animationId = requestAnimationFrame(runGame);
    }

    function draw() {
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
        g.addColorStop(0, 'rgba(60, 40, 100, 0.2)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(BOSS_X, BOSS_Y);
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 2;
        roundRect(ctx, -BOSS_WIDTH / 2, -BOSS_HEIGHT / 2, BOSS_WIDTH, BOSS_HEIGHT, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#a78bfa';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS', 0, 6);
        ctx.restore();

        ctx.fillStyle = '#f97316';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1.5;
        for (const m of minions) {
            ctx.fillRect(m.x, m.y, m.w, m.h);
            ctx.strokeRect(m.x, m.y, m.w, m.h);
        }

        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(playerX, PLAYER_Y, PLAYER_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#38bdf8';
        for (const l of playerLasers) {
            ctx.fillRect(l.x, l.y, l.w, l.h);
        }

        ctx.fillStyle = '#f87171';
        ctx.shadowColor = '#f87171';
        ctx.shadowBlur = 8;
        for (const l of bossLasers) {
            ctx.fillRect(l.x, l.y, l.w, l.h);
        }
        ctx.shadowBlur = 0;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function startGame() {
        gameOverEl.style.display = 'none';
        victoryEl.style.display = 'none';
        bossHp = BOSS_MAX_HP;
        updateBossHealthBar();
        playerX = canvas.width / 2;
        mouseX = canvas.width / 2;
        playerLasers = [];
        bossLasers = [];
        minions = [];
        nextBossLaserAt = performance.now() + 800;
        nextBossBigLaserAt = performance.now() + BOSS_BIG_LASER_INTERVAL_MIN;
        nextPlayerShotAt = performance.now();
        bossShotCount = 0;
        nextMinionSpawnAt = performance.now() + MINION_RESPAWN_INTERVAL_MS;
        lastBossPhase = 0;
        gameRunning = true;
        runGame();
    }

    canvas.addEventListener('click', function (e) {
        if (!gameRunning) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        if (cy >= 0 && cy <= canvas.height) shootPlayerLaser();
    });

    canvas.addEventListener('mousemove', function (e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseInCanvas = true;
    });
    canvas.addEventListener('mouseleave', function () {
        mouseInCanvas = false;
    });

    document.addEventListener('keydown', function (e) {
        keys[e.key] = true;
        if (e.key === ' ' && gameRunning) {
            e.preventDefault();
            shootPlayerLaser();
        }
    });
    document.addEventListener('keyup', function (e) { keys[e.key] = false; });

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', startGame);
    victoryRestartBtn.addEventListener('click', startGame);

    updateBossHealthBar();
})();
