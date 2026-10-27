(() => {
    'use strict';

    // ====== КОНСТАНТЫ ======
    const TILE = 20;          // размер одной клетки в пикселях
    const COLS = 28;          // ширина лабиринта в клетках
    const ROWS = 31;          // высота лабиринта в клетках

    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const livesEl = document.getElementById('lives');
    const levelEl = document.getElementById('level');
    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayText = document.getElementById('overlay-text');
    const startBtn = document.getElementById('start-btn');

    // ====== КАРТА ЛАБИРИНТА ======
    // '#' — стена, '.' — точка, 'o' — энергизатор, ' ' — пусто, '-' — ворота призраков
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

    // ====== КЛАСС СУЩНОСТИ (общая база для игрока и призраков) ======
    class Entity {
        constructor(x, y, speed) {
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
        // Проверка: можно ли стоять в клетке (не стена)
        canMove(cx, cy, map) {
            if (cx < 0 || cx >= COLS) return true; // туннель по бокам
            if (cy < 0 || cy >= ROWS) return false;
            const tile = map[cy][cx];
            return tile !== '#' && tile !== '-';
        }
    }

    // ====== ИГРОК ======
    class Pacman extends Entity {
        constructor() {
            super(13.5 * TILE, 23 * TILE, 2);
            this.dir = { x: 0, y: 0 };
            this.nextDir = { x: 0, y: 0 };
            this.mouth = 0;
            this.mouthDir = 1;
            this.radius = TILE * 0.42;
        }
        update(map) {
            // Пробуем повернуть
            if (this.nextDir.x !== 0 || this.nextDir.y !== 0) {
                const testX = this.x + this.nextDir.x * this.speed;
                const testY = this.y + this.nextDir.y * this.speed;
                if (this.canMove(
                    Math.floor((testX + this.radius) / TILE),
                    Math.floor(testY / TILE), map) &&
                    this.canMove(
                    Math.floor((testX - this.radius) / TILE),
                    Math.floor(testY / TILE), map) &&
                    this.canMove(
                    Math.floor(testX / TILE),
                    Math.floor((testY + this.radius) / TILE), map) &&
                    this.canMove(
                    Math.floor(testX / TILE),
                    Math.floor((testY - this.radius) / TILE), map)
                ) {
                    // выравниваем по сетке при повороте
                    if (this.nextDir.x !== 0) this.y = Math.round(this.y / TILE) * TILE;
                    if (this.nextDir.y !== 0) this.x = Math.round(this.x / TILE) * TILE;
                    this.dir = { ...this.nextDir };
                }
            }

            // Движение
            if (this.dir.x !== 0 || this.dir.y !== 0) {
                const nx = this.x + this.dir.x * this.speed;
                const ny = this.y + this.dir.y * this.speed;

                const checkX = Math.floor((nx + this.dir.x * this.radius) / TILE);
                const checkY = Math.floor((ny + this.dir.y * this.radius) / TILE);
                const curX = Math.floor(nx / TILE);
                const curY = Math.floor(ny / TILE);

                if (this.canMove(checkX, checkY, map) && this.canMove(curX, curY, map)) {
                    this.x = nx;
                    this.y = ny;
                }
            }

            // Туннель
            if (this.x < -TILE) this.x = COLS * TILE + TILE;
            if (this.x > COLS * TILE + TILE) this.x = -TILE;

            // Анимация рта
            this.mouth += 0.15 * this.mouthDir;
            if (this.mouth > 1 || this.mouth < 0) this.mouthDir *= -1;
        }
        draw() {
            const cx = this.x;
            const cy = this.y;
            const r = this.radius;
            const angle = Math.atan2(this.dir.y, this.dir.x);
            const open = Math.abs(Math.sin(this.mouth * Math.PI)) * 0.35 + 0.02;

            ctx.save();
            ctx.translate(cx, cy);
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
        constructor(x, y, color, id) {
            super(x * TILE + TILE / 2, y * TILE + TILE / 2, 1.6);
            this.color = color;
            this.id = id;
            this.dir = { x: 0, y: 0 };
            this.frightened = false;
            this.frightTimer = 0;
            this.eaten = false;
            this.homeX = this.x;
            this.homeY = this.y;
        }
        reset() {
            super.reset();
            this.frightened = false;
            this.frightTimer = 0;
            this.eaten = false;
            this.dir = { x: 0, y: -1 };
        }
        // Выбор направления: приоритет — не разворачиваться
        chooseDirection(map, targetX, targetY, randomize = false) {
            const dirs = [
                { x: 0, y: -1 }, // вверх
                { x: -1, y: 0 }, // влево
                { x: 0, y: 1 },  // вниз
                { x: 1, y: 0 }   // вправо
            ];
            const options = [];
            const curCol = Math.floor(this.x / TILE);
            const curRow = Math.floor(this.y / TILE);

            for (const d of dirs) {
                // не разворачиваемся
                if (d.x === -this.dir.x && d.y === -this.dir.y) continue;
                const nc = curCol + d.x;
                const nr = curRow + d.y;
                if (nc < 0 || nc >= COLS) {
                    // туннель — разрешаем
                    options.push(d);
                    continue;
                }
                if (nr < 0 || nr >= ROWS) continue;
                if (this.canMove(nc, nr, map)) options.push(d);
            }

            if (options.length === 0) {
                // тупик — разворот
                this.dir = { x: -this.dir.x, y: -this.dir.y };
                return;
            }

            if (randomize || this.frightened) {
                this.dir = options[Math.floor(Math.random() * options.length)];
                return;
            }

            // Выбираем ближайшее к цели
            let best = options[0];
            let bestDist = Infinity;
            for (const d of options) {
                const nx = curCol + d.x;
                const ny = curRow + d.y;
                const dist = (nx - targetX) ** 2 + (ny - targetY) ** 2;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = d;
                }
            }
            this.dir = best;
        }
        update(map, pacman, ghosts) {
            // Двигаемся только когда в центре клетки
            const centerX = Math.floor(this.x / TILE) * TILE + TILE / 2;
            const centerY = Math.floor(this.y / TILE) * TILE + TILE / 2;
            const atCenter = Math.abs(this.x - centerX) < this.speed &&
                             Math.abs(this.y - centerY) < this.speed;

            if (atCenter) {
                // выравниваем
                this.x = centerX;
                this.y = centerY;

                const pCol = Math.floor(pacman.x / TILE);
                const pRow = Math.floor(pacman.y / TILE);

                let tx = pCol, ty = pRow;

                if (!this.frightened && !this.eaten) {
                    // разные стратегии
                    if (this.id === 0) {
                        // красный — прямо на пакмана
                        tx = pCol; ty = pRow;
                    } else if (this.id === 1) {
                        // розовый — за 4 клетки впереди
                        tx = pCol + pacman.dir.x * 4;
                        ty = pRow + pacman.dir.y * 4;
                    } else if (this.id === 2) {
                        // голубой — вектор от красного через точку впереди
                        const rCol = Math.floor(ghosts[0].x / TILE);
                        const rRow = Math.floor(ghosts[0].y / TILE);
                        const ax = pCol + pacman.dir.x * 2;
                        const ay = pRow + pacman.dir.y * 2;
                        tx = ax + (ax - rCol);
                        ty = ay + (ay - rRow);
                    } else {
                        // оранжевый — убегает если близко
                        const dist = (pCol - Math.floor(this.x / TILE)) ** 2 +
                                     (pRow - Math.floor(this.y / TILE)) ** 2;
                        if (dist < 64) {
                            tx = Math.floor(Math.random() * COLS);
                            ty = Math.floor(Math.random() * ROWS);
                        } else {
                            tx = pCol; ty = pRow;
                        }
                    }
                }

                if (this.eaten) {
                    tx = Math.floor(this.homeX / TILE);
                    ty = Math.floor(this.homeY / TILE);
                }

                this.chooseDirection(map, tx, ty, this.frightened);

                if (this.eaten &&
                    Math.abs(this.x - this.homeX) < TILE &&
                    Math.abs(this.y - this.homeY) < TILE) {
                    this.eaten = false;
                    this.frightened = false;
                }
            }

            // Движение
            this.x += this.dir.x * this.speed;
            this.y += this.dir.y * this.speed;

            // Туннель
            if (this.x < -TILE) this.x = COLS * TILE + TILE;
            if (this.x > COLS * TILE + TILE) this.x = -TILE;

            // Таймер испуга
            if (this.frightened) {
                this.frightTimer--;
                if (this.frightTimer <= 0) {
                    this.frightened = false;
                }
            }
        }
        draw() {
            const x = this.x;
            const y = this.y;
            const r = TILE * 0.42;

            let bodyColor = this.color;
            if (this.frightened) {
                if (this.frightTimer < 120 && Math.floor(this.frightTimer / 15) % 2 === 0) {
                    bodyColor = '#ffffff';
                } else {
                    bodyColor = '#2121ff';
                }
            }
            if (this.eaten) {
                // только глаза
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

            // тело призрака
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
            ctx.lineTo(x + r, y + r * 0.7);

            // волнистый низ
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

            // глаза
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
                // испуганное лицо
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
            this.state = 'idle'; // idle | playing | paused | dying | won | gameover
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
                for (const t of row) {
                    if (t === '.' || t === 'o') this.dotsLeft++;
                }
            }
        }

        initGhosts() {
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

        // Поедание точек
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
                // испуг призраков
                for (const g of this.ghosts) {
                    if (!g.eaten) {
                        g.frightened = true;
                        g.frightTimer = 300;
                        // разворот
                        g.dir = { x: -g.dir.x, y: -g.dir.y };
                    }
                }
            }
            this.updateHUD();
        }

        // Столкновения
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
                        return true; // столкновение — смерть
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

            for (const g of this.ghosts) {
                g.update(this.map, this.pacman, this.ghosts);
            }

            if (this.checkCollisions()) {
                this.loseLife();
                return;
            }

            if (this.dotsLeft === 0) {
                this.nextLevel();
            }
        }

        draw() {
            // фон
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // карта
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const t = this.map[r][c];
                    const x = c * TILE;
                    const y = r * TILE;

                    if (t === '#') {
                        ctx.fillStyle = '#1a1aff';
                        ctx.fillRect(x, y, TILE, TILE);
                        // внутренний контур
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

            // призраки и пакман
            for (const g of this.ghosts) g.draw();
            this.pacman.draw();

            // пауза
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

    // ====== ЗАПУСК ======
    const game = new Game();

    function loop() {
        game.update();
        game.draw();
        requestAnimationFrame(loop);
    }
    loop();

    startBtn.addEventListener('click', () => {
        if (game.state === 'gameover' || game.state === 'idle') {
            game.start();
        } else {
            game.state = 'playing';
            overlay.classList.add('hidden');
        }
    });
})();