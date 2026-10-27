(() => {
    'use strict';

    const TILE = 20;
    const COLS = 28;
    const ROWS = 31;

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const livesEl = document.getElementById('lives');
    const levelEl = document.getElementById('level');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayText = document.getElementById('overlay-text');
    const startBtn = document.getElementById('start-btn');

    const RAW_MAP = [
        "############################",
        "#............##............#",
        "#.####.#####.##.#####.####.#",
        "#o####.#####.##.#####.####o#",
        "#.####.#####.##.#####.####.#",
        "#..........................#",
        "#.####.##.########.##.####.#",
        "#.####.##.########.##.####.#",
        "#......##....##....##......#",
        "######.##### ## #####.######",
        "     #.##### ## #####.#     ",
        "     #.##          ##.#     ",
        "     #.## ###--### ##.#     ",
        "######.## #      # ##.######",
        "      .   #      #   .      ",
        "######.## #      # ##.######",
        "     #.## ######## ##.#     ",
        "     #.##          ##.#     ",
        "     #.## ######## ##.#     ",
        "######.## ######## ##.######",
        "#............##............#",
        "#.####.#####.##.#####.####.#",
        "#.####.#####.##.#####.####.#",
        "#o..##.......  .......##..o#",
        "###.##.##.########.##.##.###",
        "###.##.##.########.##.##.###",
        "#......##....##....##......#",
        "#.##########.##.##########.#",
        "#.##########.##.##########.#",
        "#..........................#",
        "############################"
    ];

    // ====== БАЗОВЫЙ КЛАСС ======
    class Entity {
        constructor(x, y, speed) {
            // координаты в пикселях (центр спрайта)
            this.startX = x;
            this.startY = y;
            this.speed = speed;
            this.reset();
        }
        reset() {
            this.x = this.startX;
            this.y = this.startY;
            this.dir = { x: 0, y: 0 };
            this.nextDir = { x: 0, y: 0 };
        }

        // Стена ли клетка (для призраков ворота '--' проходимы)
        isWall(col, row, passGate = false) {
            if (row < 0 || row >= ROWS) return true;
            if (col < 0 || col >= COLS) return false; // туннель
            const t = RAW_MAP[row][col];
            if (t === '#') return true;
            if (t === '-' && !passGate) return true;
            return false;
        }

        // Признак того, что сущность «в центре» клетки (с допуском)
        isAtCenter(tolerance = 1) {
            const cx = Math.floor(this.x / TILE) * TILE + TILE / 2;
            const cy = Math.floor(this.y / TILE) * TILE + TILE / 2;
            return Math.abs(this.x - cx) <= tolerance &&
                   Math.abs(this.y - cy) <= tolerance;
        }

        // Выровнять по центру текущей клетки
        snapToCenter() {
            this.x = Math.floor(this.x / TILE) * TILE + TILE / 2;
            this.y = Math.floor(this.y / TILE) * TILE + TILE / 2;
        }

        // Плавно двигаться в направлении dir, останавливаясь у стены
        moveAlongDir(map) {
            if (this.dir.x === 0 && this.dir.y === 0) return;
            const col = Math.floor(this.x / TILE);
            const row = Math.floor(this.y / TILE);

            // Проверяем следующую клетку в направлении движения
            const nc = col + this.dir.x;
            const nr = row + this.dir.y;

            // Если впереди стена и мы уже у её края — стоп
            if (this.isWall(nc, nr, this.passGate)) {
                // двигаемся только до центра текущей клетки
                const cx = col * TILE + TILE / 2;
                const cy = row * TILE + TILE / 2;
                if (this.dir.x > 0 && this.x < cx) this.x = Math.min(this.x + this.speed, cx);
                if (this.dir.x < 0 && this.x > cx) this.x = Math.max(this.x - this.speed, cx);
                if (this.dir.y > 0 && this.y < cy) this.y = Math.min(this.y + this.speed, cy);
                if (this.dir.y < 0 && this.y > cy) this.y = Math.max(this.y - this.speed, cy);
            } else {
                this.x += this.dir.x * this.speed;
                this.y += this.dir.y * this.speed;
            }

            // Телепорт в туннеле
            if (this.x < -TILE / 2) this.x = COLS * TILE + TILE / 2;
            if (this.x > COLS * TILE + TILE / 2) this.x = -TILE / 2;
        }
    }

    // ====== ИГРОК ======
    class Pacman extends Entity {
        constructor() {
            super(13.5 * TILE + TILE / 2, 23 * TILE + TILE / 2, 2);
            this.radius = TILE * 0.42;
            this.mouth = 0;
            this.mouthDir = 1;
            this.passGate = false;
        }

        update(map) {
            // Если есть желаемое направление и мы можем повернуть — поворачиваем
            // Поворот возможен только когда мы выровнены (хотя бы по одной оси)
            const tryTurn = () => {
                if (this.nextDir.x === 0 && this.nextDir.y === 0) return false;
                // Разрешаем смену направления только у центра клетки
                if (!this.isAtCenter(this.speed)) return false;

                const col = Math.floor(this.x / TILE);
                const row = Math.floor(this.y / TILE);
                if (!this.isWall(col + this.nextDir.x, row + this.nextDir.y, false)) {
                    this.snapToCenter();
                    this.dir = { ...this.nextDir };
                    return true;
                }
                return false;
            };

            // Пробуем повернуть (в т.ч. разворот на 180°)
            if (this.nextDir.x !== this.dir.x || this.nextDir.y !== this.dir.y) {
                // Разворот на 180° разрешаем в любой момент
                if (this.nextDir.x === -this.dir.x && this.nextDir.y === -this.dir.y &&
                    (this.dir.x !== 0 || this.dir.y !== 0)) {
                    this.dir = { ...this.nextDir };
                } else {
                    tryTurn();
                }
            }

            // Если стоим у стены, но nextDir свободен и мы в центре — поехали
            if (this.dir.x === 0 && this.dir.y === 0) {
                tryTurn();
            }

            this.moveAlongDir(map);

            // Анимация рта
            if (this.dir.x !== 0 || this.dir.y !== 0) {
                this.mouth += 0.15 * this.mouthDir;
                if (this.mouth > 1 || this.mouth < 0) this.mouthDir *= -1;
            }
        }

        draw() {
            const r = this.radius;
            const angle = Math.atan2(this.dir.y, this.dir.x) || 0;
            const open = Math.abs(Math.sin(this.mouth * Math.PI)) * 0.35 + 0.02;

            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, r, open * Math.PI, (2 - open) * Math.PI);
            ctx.closePath();
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.restore();
        }
    }

    // ====== ПРИЗРАК ======
    const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852'];

    class Ghost extends Entity {
        constructor(tileX, tileY, color, id) {
            super(tileX * TILE + TILE / 2, tileY * TILE + TILE / 2, 1.6);
            this.color = color;
            this.id = id;
            this.frightened = false;
            this.frightTimer = 0;
            this.eaten = false;
            this.passGate = true; // призраки проходят через ворота
            this.homeX = this.x;
            this.homeY = this.y;
        }

        reset() {
            super.reset();
            this.frightened = false;
            this.frightTimer = 0;
            this.eaten = false;
            this.dir = { x: 0, y: -1 };
            this.nextDir = { x: 0, y: -1 };
        }

        // Выбор направления движения (у центра клетки)
        chooseDirection(map, targetCol, targetRow) {
            const col = Math.floor(this.x / TILE);
            const row = Math.floor(this.y / TILE);

            const dirs = [
                { x: 0, y: -1 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 1, y: 0 }
            ];

            // Свободные направления (кроме разворота)
            const options = dirs.filter(d => {
                if (d.x === -this.dir.x && d.y === -this.dir.y) return false;
                const nc = col + d.x;
                const nr = row + d.y;
                if (nc < 0 || nc >= COLS) return true; // туннель
                return !this.isWall(nc, nr, this.passGate);
            });

            // В «доме» призракам нельзя выходить через стены дома — но passGate=true
            // При испуге — случайно
            if (this.frightened) {
                if (options.length === 0) {
                    this.dir = { x: -this.dir.x, y: -this.dir.y };
                } else {
                    this.dir = options[Math.floor(Math.random() * options.length)];
                }
                return;
            }

            if (options.length === 0) {
                this.dir = { x: -this.dir.x, y: -this.dir.y };
                return;
            }

            let best = options[0];
            let bestDist = Infinity;
            for (const d of options) {
                const nx = col + d.x;
                const ny = row + d.y;
                const dist = (nx - targetCol) ** 2 + (ny - targetRow) ** 2;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = d;
                }
            }
            this.dir = best;
        }

        update(map, pacman, ghosts) {
            // 1) Если в центре клетки — выбираем направление
            if (this.isAtCenter(this.speed)) {
                this.snapToCenter();

                const pCol = Math.floor(pacman.x / TILE);
                const pRow = Math.floor(pacman.y / TILE);
                let tx = pCol, ty = pRow;

                if (this.eaten) {
                    tx = Math.floor(this.homeX / TILE);
                    ty = Math.floor(this.homeY / TILE);
                } else if (!this.frightened) {
                    if (this.id === 0) {
                        tx = pCol; ty = pRow;
                    } else if (this.id === 1) {
                        tx = pCol + pacman.dir.x * 4;
                        ty = pRow + pacman.dir.y * 4;
                    } else if (this.id === 2) {
                        const rCol = Math.floor(ghosts[0].x / TILE);
                        const rRow = Math.floor(ghosts[0].y / TILE);
                        const ax = pCol + pacman.dir.x * 2;
                        const ay = pRow + pacman.dir.y * 2;
                        tx = ax + (ax - rCol);
                        ty = ay + (ay - rRow);
                    } else {
                        const dist = (pCol - Math.floor(this.x / TILE)) ** 2 +
                                     (pRow - Math.floor(this.y / TILE)) ** 2;
                        if (dist < 64) {
                            tx = Math.floor(Math.random() * COLS);
                            ty = Math.floor(Math.random() * ROWS);
                        }
                    }
                }

                this.chooseDirection(map, tx, ty);

                // Проверка возврата домой после съедения
                if (this.eaten &&
                    Math.abs(this.x - this.homeX) < TILE / 2 &&
                    Math.abs(this.y - this.homeY) < TILE / 2) {
                    this.eaten = false;
                    this.frightened = false;
                    this.dir = { x: 0, y: -1 };
                }
            }

            // 2) Движение с проверкой стены
            this.moveAlongDir(map);

            // 3) Таймер испуга
            if (this.frightened) {
                this.frightTimer--;
                if (this.frightTimer <= 0) this.frightened = false;
            }
        }

        draw() {
            const x = this.x, y = this.y;
            const r = TILE * 0.42;

            let bodyColor = this.color;
            if (this.frightened) {
                bodyColor = (this.frightTimer < 120 && Math.floor(this.frightTimer / 15) % 2 === 0)
                    ? '#ffffff' : '#2121ff';
            }
            if (this.eaten) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x - r * 0.35, y - r * 0.2, r * 0.28, 0, Math.PI * 2);
                ctx.arc(x + r * 0.35, y - r * 0.2, r * 0.28, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#0000ff';
                ctx.beginPath();
                ctx.arc(x - r * 0.35 + this.dir.x * 2, y - r * 0.2 + this.dir.y * 2, r * 0.13, 0, Math.PI * 2);
                ctx.arc(x + r * 0.35 + this.dir.x * 2, y - r * 0.2 + this.dir.y * 2, r * 0.13, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            ctx.save();
            ctx.shadowColor = bodyColor;
            ctx.shadowBlur = 8;
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
            ctx.lineTo(x + r, y + r * 0.7);
            const waves = 4;
            const waveW = (r * 2) / waves;
            for (let i = 0; i < waves; i++) {
                const wx = x + r - i * waveW;
                const wy = y + r * 0.7 + (i % 2 === 0 ? r * 0.25 : -r * 0.1);
                ctx.lineTo(wx - waveW / 2, wy);
            }
            ctx.lineTo(x - r, y + r * 0.7);
            ctx.closePath();
            ctx.fill();

            if (!this.frightened) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(x - r * 0.35, y - r * 0.15, r * 0.28, r * 0.34, 0, 0, Math.PI * 2);
                ctx.ellipse(x + r * 0.35, y - r * 0.15, r * 0.28, r * 0.34, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#0000ff';
                ctx.beginPath();
                ctx.arc(x - r * 0.35 + this.dir.x * 3, y - r * 0.15 + this.dir.y * 3, r * 0.15, 0, Math.PI * 2);
                ctx.arc(x + r * 0.35 + this.dir.x * 3, y - r * 0.15 + this.dir.y * 3, r * 0.15, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2);
                ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x - r * 0.4, y + r * 0.35);
                for (let i = 0; i <= 4; i++) {
                    const px = x - r * 0.4 + (i * r * 0.8) / 4;
                    const py = y + r * 0.35 + (i % 2 === 0 ? 0 : r * 0.15);
                    ctx.lineTo(px, py);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    // ====== ИГРА ======
    class Game {
        constructor() {
            this.map = [];
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.state = 'idle';
            this.dotsLeft = 0;
            this.pacman = new Pacman();
            this.ghosts = [];
            this.initMap();
            this.initGhosts();
            this.bindKeys();
        }

        initMap() {
            this.map = RAW_MAP.map(row => row.split(''));
            this.dotsLeft = 0;
            for (const row of this.map) {
                for (const t of row) if (t === '.' || t === 'o') this.dotsLeft++;
            }
        }

        initGhosts() {
            // тайлы 11..15, ряды 11..14 — «дом» призраков
            this.ghosts = [
                new Ghost(13.5, 11, GHOST_COLORS[0], 0),
                new Ghost(13.5, 14, GHOST_COLORS[1], 1),
                new Ghost(11.5, 14, GHOST_COLORS[2], 2),
                new Ghost(15.5, 14, GHOST_COLORS[3], 3)
            ];
        }

        resetPositions() {
            this.pacman.reset();
            for (const g of this.ghosts) g.reset();
        }

        bindKeys() {
            const keyMap = {
                ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
                ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
                ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 }
            };
            document.addEventListener('keydown', e => {
                if (keyMap[e.key]) {
                    e.preventDefault();
                    this.pacman.nextDir = keyMap[e.key];
                }
                if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
                    e.preventDefault();
                    if (this.state === 'playing') this.state = 'paused';
                    else if (this.state === 'paused') this.state = 'playing';
                }
            });
        }

        start() {
            this.score = 0;
            this.lives = 3;
            this.level = 1;
            this.pacman.speed = 2;
            for (const g of this.ghosts) g.speed = 1.6;
            this.startLevel();
        }

        startLevel() {
            this.initMap();
            this.resetPositions();
            this.state = 'playing';
            this.updateHUD();
            overlay.classList.add('hidden');
        }

        updateHUD() {
            scoreEl.textContent = this.score;
            livesEl.textContent = '❤'.repeat(this.lives);
            levelEl.textContent = this.level;
        }

        eatDot() {
            const col = Math.floor(this.pacman.x / TILE);
            const row = Math.floor(this.pacman.y / TILE);
            if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
            const t = this.map[row][col];
            if (t === '.') {
                this.map[row][col] = ' ';
                this.score += 10;
                this.dotsLeft--;
            } else if (t === 'o') {
                this.map[row][col] = ' ';
                this.score += 50;
                this.dotsLeft--;
                for (const g of this.ghosts) {
                    if (!g.eaten) {
                        g.frightened = true;
                        g.frightTimer = 300;
                        g.dir = { x: -g.dir.x, y: -g.dir.y };
                    }
                }
            }
            this.updateHUD();
        }

        checkCollisions() {
            for (const g of this.ghosts) {
                const dx = g.x - this.pacman.x;
                const dy = g.y - this.pacman.y;
                if (dx * dx + dy * dy < (TILE * 0.7) ** 2) {
                    if (g.frightened && !g.eaten) {
                        g.eaten = true;
                        g.frightened = false;
                        this.score += 200;
                        this.updateHUD();
                    } else if (!g.eaten) {
                        return true;
                    }
                }
            }
            return false;
        }

        loseLife() {
            this.lives--;
            this.updateHUD();
            if (this.lives <= 0) {
                this.state = 'gameover';
                overlayTitle.textContent = 'GAME OVER';
                overlayText.textContent = `Итог: ${this.score} очков`;
                startBtn.textContent = 'Играть снова';
                overlay.classList.remove('hidden');
            } else {
                this.resetPositions();
            }
        }

        nextLevel() {
            this.level++;
            this.pacman.speed = Math.min(2 + this.level * 0.15, 3);
            for (const g of this.ghosts) g.speed = Math.min(1.6 + this.level * 0.1, 2.4);
            this.startLevel();
        }

        update() {
            if (this.state !== 'playing') return;
            this.pacman.update(this.map);
            this.eatDot();
            for (const g of this.ghosts) g.update(this.map, this.pacman, this.ghosts);
            if (this.checkCollisions()) { this.loseLife(); return; }
            if (this.dotsLeft === 0) this.nextLevel();
        }

        draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const t = this.map[r][c];
                    const x = c * TILE, y = r * TILE;
                    if (t === '#') {
                        ctx.fillStyle = '#1a1aff';
                        ctx.fillRect(x, y, TILE, TILE);
                        ctx.strokeStyle = '#4444ff';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
                    } else if (t === '.') {
                        ctx.fillStyle = '#ffb8b8';
                        ctx.beginPath();
                        ctx.arc(x + TILE / 2, y + TILE / 2, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (t === 'o') {
                        ctx.fillStyle = '#ffb8b8';
                        ctx.shadowColor = '#ffb8b8';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.arc(x + TILE / 2, y + TILE / 2, 6, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    } else if (t === '-') {
                        ctx.fillStyle = '#ffb8ff';
                        ctx.fillRect(x, y + TILE / 2 - 2, TILE, 4);
                    }
                }
            }

            for (const g of this.ghosts) g.draw();
            this.pacman.draw();

            if (this.state === 'paused') {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#ffcc00';
                ctx.font = 'bold 36px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText('ПАУЗА', canvas.width / 2, canvas.height / 2);
            }
        }
    }

    const game = new Game();
    function loop() {
        game.update();
        game.draw();
        requestAnimationFrame(loop);
    }
    loop();

    startBtn.addEventListener('click', () => {
        if (game.state === 'gameover' || game.state === 'idle') game.start();
        else { game.state = 'playing'; overlay.classList.add('hidden'); }
    });
})();