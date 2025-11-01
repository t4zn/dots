class PinsGame {
    constructor() {
        this.gridSize = 6; // Default 6x6 grid of dots
        this.playerCount = 2; // Default 2 players
        this.currentPlayer = 1;
        this.scores = {};
        this.lines = new Set();
        this.drawnLines = new Map(); // Track which player drew each line
        this.lastDrawnLine = null; // Track the most recent line
        this.boxes = [];
        this.gameOver = false;
        this.gameStarted = false;
        this.turnTextTimeout = null; // Track timeout for turn text
        this.colorTheme = 'blue-red'; // Default color theme
        this.gameMode = '2player'; // '2player' or 'bot'
        this.botThinking = false; // Track if bot is thinking
        this.difficulty = 'easy'; // 'easy', 'medium', 'hard'
        this.audioContext = null; // Audio context for sound effects
        this.soundEnabled = true; // Sound effects toggle
        
        // Initialize scores for default player count
        for (let i = 1; i <= this.playerCount; i++) {
            this.scores[`player${i}`] = 0;
        }
        
        // Player colors based on player count
        this.playerColors = {
            2: ['#3b82f6', '#ef4444'], // Blue, Red
            3: ['#ef4444', '#3b82f6', '#10b981'], // Red, Blue, Green
            4: ['#ef4444', '#3b82f6', '#10b981', '#eab308'], // Red, Blue, Green, Yellow
            5: ['#ef4444', '#3b82f6', '#10b981', '#eab308', '#a855f7'] // Red, Blue, Green, Yellow, Purple
        };

        this.setupEventListeners();
        this.initAudio();
    }

    initAudio() {
        this.musicPlaying = false;
        this.musicGain = null;
        this.musicOscillators = [];
        
        // Initialize audio context on first user interaction
        const initContext = () => {
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    console.log('Audio context initialized');
                } catch (e) {
                    console.error('Failed to create audio context:', e);
                }
            }
        };
        
        // Try to initialize on various user interactions
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, initContext, { once: true });
        });
    }

    playSound(type) {
        // Check if sound is enabled
        if (!this.soundEnabled) {
            return;
        }
        
        // Try to initialize audio context if not already done
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                return;
            }
        }
        
        // Resume context if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const ctx = this.audioContext;
        const now = ctx.currentTime;

        switch(type) {
            case 'line':
                // Quick pop sound for drawing a line
                this.playLineSound(ctx, now);
                break;
            case 'box':
                // Satisfying fill sound for completing a box
                this.playBoxSound(ctx, now);
                break;
            case 'win':
                // Victory fanfare
                this.playWinSound(ctx, now);
                break;
        }
    }

    playLineSound(ctx, now) {
        // Create a scratchy, sweeping sound like drawing on paper
        const bufferSize = ctx.sampleRate * 0.25; // 250ms duration
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate white noise with envelope for scratchy sound
        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            // White noise
            const noise = (Math.random() * 2 - 1) * 0.3;
            // Envelope: quick attack, sustained, quick release
            let envelope;
            if (t < 0.02) {
                envelope = t / 0.02; // Attack
            } else if (t < 0.2) {
                envelope = 1; // Sustain
            } else {
                envelope = (0.25 - t) / 0.05; // Release
            }
            data[i] = noise * envelope;
        }
        
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        
        source.buffer = buffer;
        
        // High-pass filter for pencil/marker texture
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(1, now);
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        gain.gain.setValueAtTime(0.12, now);
        
        source.start(now);
        source.stop(now + 0.25);
    }

    playBoxSound(ctx, now) {
        // Two-tone ascending sound for box completion
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        osc1.frequency.setValueAtTime(523, now); // C5
        osc2.frequency.setValueAtTime(659, now + 0.08); // E5
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.setValueAtTime(0.2, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        
        osc1.start(now);
        osc1.stop(now + 0.15);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.25);
    }

    playWinSound(ctx, now) {
        // Victory chord progression
        const frequencies = [523, 659, 784]; // C-E-G major chord
        
        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.setValueAtTime(freq, now);
            osc.type = 'sine';
            
            const startTime = now + (i * 0.1);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
            
            osc.start(startTime);
            osc.stop(startTime + 0.6);
        });
        
        // Add a final high note
        const finalOsc = ctx.createOscillator();
        const finalGain = ctx.createGain();
        
        finalOsc.connect(finalGain);
        finalGain.connect(ctx.destination);
        
        finalOsc.frequency.setValueAtTime(1047, now + 0.3); // C6
        finalOsc.type = 'sine';
        
        finalGain.gain.setValueAtTime(0, now + 0.3);
        finalGain.gain.linearRampToValueAtTime(0.2, now + 0.35);
        finalGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        
        finalOsc.start(now + 0.3);
        finalOsc.stop(now + 0.8);
    }

    initializeGame() {
        this.createGrid();
        this.updateUI();
    }

    createGrid() {
        const svg = document.getElementById('game-svg');
        svg.innerHTML = '';

        // Dynamic spacing based on grid size
        const spacing = 120;
        const totalWidth = (this.gridSize - 1) * spacing;
        const totalHeight = (this.gridSize - 1) * spacing;
        const padding = 40;
        const viewBoxWidth = totalWidth + (padding * 2);
        const viewBoxHeight = totalHeight + (padding * 2);

        // Update SVG viewBox to center the grid
        svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);

        const offset = padding;

        // Create horizontal lines
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize - 1; col++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const dotRadius = 16;
                const gap = 2; // Small gap between line and dot
                const x1 = offset + col * spacing + dotRadius + gap;
                const y1 = offset + row * spacing;
                const x2 = offset + (col + 1) * spacing - dotRadius - gap;
                const y2 = offset + row * spacing;

                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('class', `line horizontal player${this.currentPlayer}-hover`);
                line.setAttribute('data-row', row);
                line.setAttribute('data-col', col);
                line.setAttribute('data-type', 'horizontal');

                line.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.drawLine(line);
                });
                svg.appendChild(line);
            }
        }

        // Create vertical lines
        for (let row = 0; row < this.gridSize - 1; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const dotRadius = 16;
                const gap = 2; // Small gap between line and dot
                const x1 = offset + col * spacing;
                const y1 = offset + row * spacing + dotRadius + gap;
                const x2 = offset + col * spacing;
                const y2 = offset + (row + 1) * spacing - dotRadius - gap;

                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('class', `line vertical player${this.currentPlayer}-hover`);
                line.setAttribute('data-row', row);
                line.setAttribute('data-col', col);
                line.setAttribute('data-type', 'vertical');

                line.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.drawLine(line);
                });
                svg.appendChild(line);
            }
        }

        // Create boxes (initially invisible)
        for (let row = 0; row < this.gridSize - 1; row++) {
            for (let col = 0; col < this.gridSize - 1; col++) {
                const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                const dotRadius = 16;
                const gap = 2; // Gap between line and dot
                const lineWidth = 20; // Match the line stroke width
                // Make boxes extend almost to the lines to eliminate white space
                const x = offset + col * spacing + dotRadius + gap - 8;
                const y = offset + row * spacing + dotRadius + gap - 8;
                const width = spacing - (dotRadius + gap) * 2 + 16;
                const height = spacing - (dotRadius + gap) * 2 + 16;

                box.setAttribute('x', x);
                box.setAttribute('y', y);
                box.setAttribute('width', width);
                box.setAttribute('height', height);
                box.setAttribute('class', 'box');
                box.setAttribute('data-row', row);
                box.setAttribute('data-col', col);
                box.setAttribute('rx', 0);
                box.style.pointerEvents = 'none'; // Disable click events on boxes

                svg.appendChild(box);
                this.boxes.push({ element: box, row, col, owner: null });
            }
        }

        // Create dots last so they appear on top - solid black circles
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', offset + col * spacing);
                dot.setAttribute('cy', offset + row * spacing);
                dot.setAttribute('r', 16);
                dot.setAttribute('fill', '#000000');
                dot.setAttribute('stroke', 'none');
                dot.setAttribute('stroke-width', '0');
                dot.setAttribute('opacity', '1');
                dot.style.fill = '#000000';
                dot.style.stroke = 'none';
                dot.style.opacity = '1';
                dot.style.pointerEvents = 'none';
                svg.appendChild(dot);
            }
        }
    }

    drawLine(lineElement) {
        if (this.gameOver || lineElement.classList.contains('drawn')) {
            return;
        }

        this.gameStarted = true;

        const row = parseInt(lineElement.getAttribute('data-row'));
        const col = parseInt(lineElement.getAttribute('data-col'));
        const type = lineElement.getAttribute('data-type');
        const lineId = `${type}-${row}-${col}`;

        // Convert previous latest line to black if it exists
        if (this.lastDrawnLine) {
            this.lastDrawnLine.classList.remove('player1-line', 'player2-line', 'player3-line', 'player4-line', 'player5-line', 'current-player-line');
            this.lastDrawnLine.classList.add('drawn');
        }

        // Add line to drawn lines and track the player
        this.lines.add(lineId);
        this.drawnLines.set(lineId, this.currentPlayer);
        this.lastDrawnLine = lineElement;

        // Remove hover classes and add current player line class
        lineElement.classList.remove('player1-hover', 'player2-hover', 'player3-hover', 'player4-hover', 'player5-hover');
        lineElement.classList.add(`player${this.currentPlayer}-line`, 'current-player-line', 'drawn');

        // Play line draw sound
        this.playSound('line');

        // Smooth center-outward animation using scale transform
        lineElement.style.transformOrigin = 'center';
        lineElement.style.transform = 'scaleX(0)';
        lineElement.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

        // Trigger the animation on next frame
        requestAnimationFrame(() => {
            lineElement.style.transform = 'scaleX(1)';
        });

        // Clean up after animation
        setTimeout(() => {
            lineElement.style.transition = '';
            lineElement.style.transform = '';
            lineElement.style.transformOrigin = '';
        }, 250);

        // Check for completed boxes
        const completedBoxes = this.checkCompletedBoxes();
        let playerGetsAnotherTurn = false;

        if (completedBoxes.length > 0) {
            playerGetsAnotherTurn = true;
            
            // Play box completion sound
            this.playSound('box');
            
            completedBoxes.forEach(box => {
                box.owner = this.currentPlayer;
                box.element.classList.add('filled');
                box.element.classList.add(`player${this.currentPlayer}-box`);
                this.scores[`player${this.currentPlayer}`]++;
            });

            // Auto-complete chain: check adjacent boxes only
            setTimeout(() => {
                this.autoCompleteChain(completedBoxes[0], lineId);
            }, 300);
        }

        // Switch player if no boxes were completed
        if (!playerGetsAnotherTurn) {
            this.currentPlayer = (this.currentPlayer % this.playerCount) + 1;
        }

        this.updateUI(playerGetsAnotherTurn);
        this.checkGameEnd();
    }

    checkCompletedBoxes() {
        const completedBoxes = [];

        this.boxes.forEach(box => {
            if (box.owner !== null) return; // Already claimed

            const { row, col } = box;
            const requiredLines = [
                `horizontal-${row}-${col}`,     // top
                `horizontal-${row + 1}-${col}`, // bottom
                `vertical-${row}-${col}`,       // left
                `vertical-${row}-${col + 1}`    // right
            ];

            const hasAllLines = requiredLines.every(lineId => this.lines.has(lineId));

            if (hasAllLines) {
                completedBoxes.push(box);
            }
        });

        return completedBoxes;
    }

    updateUI(skipTurnDisplay = false) {
        // Update score display
        const scoreDisplay = document.getElementById('score-display-left');
        if (scoreDisplay) {
            let scoreHTML = '';
            for (let i = 1; i <= this.playerCount; i++) {
                const color = this.getPlayerColor(i);
                scoreHTML += `<span class="score-p${i}" style="color: ${color};">${this.scores[`player${i}`]}</span>`;
                if (i < this.playerCount) {
                    scoreHTML += '<span class="score-dot">•</span>';
                }
            }
            scoreDisplay.innerHTML = scoreHTML;
        }

        // Update body background based on current player
        document.body.className = `player${this.currentPlayer}-turn`;
        document.body.setAttribute('data-player-count', this.playerCount);

        // Update hover classes for all undrawn lines
        this.updateLineHoverClasses();

        // Show "Your Turn" display only if player changed (not getting extra turn)
        if (!skipTurnDisplay) {
            this.showTurnDisplay();
        }
    }

    updateLineHoverClasses() {
        // Update hover classes for all lines that haven't been drawn yet
        const lines = document.querySelectorAll('.line:not(.drawn)');
        lines.forEach(line => {
            // Remove all possible player hover classes
            line.classList.remove('player1-hover', 'player2-hover', 'player3-hover', 'player4-hover', 'player5-hover');
            line.classList.add(`player${this.currentPlayer}-hover`);
        });
    }

    autoCompleteChain(lastCompletedBox, lastDrawnLineId) {
        if (!lastCompletedBox) return;

        // Find adjacent boxes that need only one more line to complete
        const { row, col } = lastCompletedBox;
        const adjacentBoxes = [
            { row: row - 1, col, sharedLine: `horizontal-${row}-${col}` }, // top
            { row: row + 1, col, sharedLine: `horizontal-${row + 1}-${col}` }, // bottom
            { row, col: col - 1, sharedLine: `vertical-${row}-${col}` }, // left
            { row, col: col + 1, sharedLine: `vertical-${row}-${col + 1}` }  // right
        ];

        // Check each adjacent box
        for (const adjPos of adjacentBoxes) {
            const adjBox = this.boxes.find(b => b.row === adjPos.row && b.col === adjPos.col);
            
            if (!adjBox || adjBox.owner !== null) continue;

            // Check if the shared line between boxes was already drawn before this turn
            // If it was drawn before (black line), don't continue the chain through it
            const sharedLineWasOld = this.drawnLines.has(adjPos.sharedLine) && 
                                     adjPos.sharedLine !== lastDrawnLineId;
            
            if (sharedLineWasOld) {
                // Check if this line was drawn by current player in this chain
                const lineElement = document.querySelector(
                    `.line[data-type="${adjPos.sharedLine.split('-')[0]}"][data-row="${adjPos.sharedLine.split('-')[1]}"][data-col="${adjPos.sharedLine.split('-')[2]}"]`
                );
                
                // If the shared line is black (not current player's color), stop the chain
                if (lineElement && lineElement.classList.contains('drawn') && 
                    !lineElement.classList.contains('current-player-line')) {
                    continue; // Don't continue chain through old lines
                }
            }

            const requiredLines = [
                `horizontal-${adjPos.row}-${adjPos.col}`,
                `horizontal-${adjPos.row + 1}-${adjPos.col}`,
                `vertical-${adjPos.row}-${adjPos.col}`,
                `vertical-${adjPos.row}-${adjPos.col + 1}`
            ];

            const drawnCount = requiredLines.filter(lineId => this.lines.has(lineId)).length;
            
            if (drawnCount === 3) {
                // This adjacent box needs only 1 more line - complete it
                const requiredLinesData = [
                    { id: `horizontal-${adjPos.row}-${adjPos.col}`, type: 'horizontal', row: adjPos.row, col: adjPos.col },
                    { id: `horizontal-${adjPos.row + 1}-${adjPos.col}`, type: 'horizontal', row: adjPos.row + 1, col: adjPos.col },
                    { id: `vertical-${adjPos.row}-${adjPos.col}`, type: 'vertical', row: adjPos.row, col: adjPos.col },
                    { id: `vertical-${adjPos.row}-${adjPos.col + 1}`, type: 'vertical', row: adjPos.row, col: adjPos.col + 1 }
                ];

                const missingLine = requiredLinesData.find(line => !this.lines.has(line.id));

                if (missingLine) {
                    const lineElement = document.querySelector(
                        `.line[data-type="${missingLine.type}"][data-row="${missingLine.row}"][data-col="${missingLine.col}"]`
                    );

                    if (lineElement && !lineElement.classList.contains('drawn')) {
                        this.drawLineAuto(lineElement, adjBox, missingLine.id);
                        return; // Only complete one box at a time in the chain
                    }
                }
            }
        }
    }

    drawLineAuto(lineElement, nextBox, lineId) {
        const row = parseInt(lineElement.getAttribute('data-row'));
        const col = parseInt(lineElement.getAttribute('data-col'));
        const type = lineElement.getAttribute('data-type');
        const fullLineId = `${type}-${row}-${col}`;

        // Convert previous latest line to black if it exists
        if (this.lastDrawnLine) {
            this.lastDrawnLine.classList.remove('player1-line', 'player2-line', 'player3-line', 'player4-line', 'player5-line', 'current-player-line');
            this.lastDrawnLine.classList.add('drawn');
        }

        // Add line to drawn lines
        this.lines.add(fullLineId);
        this.drawnLines.set(fullLineId, this.currentPlayer);
        this.lastDrawnLine = lineElement;

        // Style the line
        lineElement.classList.remove('player1-hover', 'player2-hover', 'player3-hover', 'player4-hover', 'player5-hover');
        lineElement.classList.add(`player${this.currentPlayer}-line`, 'current-player-line', 'drawn');

        // Animate
        lineElement.style.transformOrigin = 'center';
        lineElement.style.transform = 'scaleX(0)';
        lineElement.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

        requestAnimationFrame(() => {
            lineElement.style.transform = 'scaleX(1)';
        });

        setTimeout(() => {
            lineElement.style.transition = '';
            lineElement.style.transform = '';
            lineElement.style.transformOrigin = '';
        }, 250);

        // Check for completed boxes
        const completedBoxes = this.checkCompletedBoxes();

        if (completedBoxes.length > 0) {
            // Play box completion sound
            this.playSound('box');
            
            completedBoxes.forEach(box => {
                box.owner = this.currentPlayer;
                box.element.classList.add('filled');
                box.element.classList.add(`player${this.currentPlayer}-box`);
                this.scores[`player${this.currentPlayer}`]++;
            });

            this.updateUI(true); // Skip turn display

            // Continue the chain with the newly completed box
            setTimeout(() => {
                this.autoCompleteChain(completedBoxes[0], fullLineId);
            }, 300);
        } else {
            this.updateUI(true);
        }

        this.checkGameEnd();
    }

    showTurnDisplay() {
        // Clear any existing timeout
        if (this.turnTextTimeout) {
            clearTimeout(this.turnTextTimeout);
        }

        const turnDisplay = document.getElementById('turn-display');

        // Show the display
        turnDisplay.classList.add('show');

        // Hide after 1.3 seconds
        this.turnTextTimeout = setTimeout(() => {
            turnDisplay.classList.remove('show');
        }, 1300);
    }





    checkGameEnd() {
        const totalPossibleBoxes = (this.gridSize - 1) * (this.gridSize - 1);
        
        // Count all players' scores
        let claimedBoxes = 0;
        for (let i = 1; i <= this.playerCount; i++) {
            claimedBoxes += this.scores[`player${i}`] || 0;
        }

        if (claimedBoxes === totalPossibleBoxes) {
            this.gameOver = true;
            // Wait for last box fill animation to complete (400ms transition)
            setTimeout(() => {
                this.showGameOverModal();
            }, 500);
        }
    }

    showGameOverModal() {
        const winScreen = document.getElementById('win-screen');
        const winText = document.getElementById('win-text');

        // Find winner(s)
        let maxScore = 0;
        let winners = [];
        
        for (let i = 1; i <= this.playerCount; i++) {
            const score = this.scores[`player${i}`];
            if (score > maxScore) {
                maxScore = score;
                winners = [i];
            } else if (score === maxScore) {
                winners.push(i);
            }
        }

        let winColor = '';
        let winColorName = '';

        if (winners.length === 1) {
            const winningPlayer = winners[0];
            winColor = this.getPlayerColor(winningPlayer);
            
            // Get color name
            const colorNames = {
                2: ['BLUE', 'RED'],
                3: ['RED', 'BLUE', 'GREEN'],
                4: ['RED', 'BLUE', 'GREEN', 'YELLOW'],
                5: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE']
            };
            
            // Handle 2-player themes
            if (this.playerCount === 2) {
                if (this.colorTheme === 'green-purple') {
                    colorNames[2] = ['GREEN', 'PURPLE'];
                } else if (this.colorTheme === 'pink-grey') {
                    colorNames[2] = ['PINK', 'GREY'];
                }
            }
            
            winColorName = colorNames[this.playerCount][winningPlayer - 1];
        } else {
            winColor = '#636e72';
            winColorName = 'DRAW';
        }

        // Play win sound
        this.playSound('win');
        
        // Show fullscreen win message
        winScreen.style.background = winColor;
        winText.innerHTML = `${winColorName}<br>WINS`;
        winScreen.classList.remove('hidden');
    }

    restartGame() {
        this.currentPlayer = 1;
        
        // Reset scores for all players
        this.scores = {};
        for (let i = 1; i <= this.playerCount; i++) {
            this.scores[`player${i}`] = 0;
        }
        
        this.lines.clear();
        this.drawnLines.clear();
        this.lastDrawnLine = null;
        this.boxes = [];
        this.gameOver = false;
        this.gameStarted = false;

        // Clear any existing turn text timeout
        if (this.turnTextTimeout) {
            clearTimeout(this.turnTextTimeout);
            this.turnTextTimeout = null;
        }

        document.getElementById('game-over-modal').classList.add('hidden');
        document.getElementById('menu-modal').classList.add('hidden');
        document.body.className = 'player1-turn'; // Reset to player 1
        document.body.setAttribute('data-player-count', this.playerCount);
        this.initializeGame();
    }

    changeGridSize(newSize) {
        if (this.gameStarted && !confirm('Changing grid size will restart the game. Continue?')) {
            return;
        }

        this.gridSize = newSize;
        this.restartGame();

        // Update active grid size button
        document.querySelectorAll('.grid-size-btn').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.dataset.size) === newSize) {
                btn.classList.add('active');
            }
        });
    }

    changeColorTheme(theme) {
        // Only allow theme changes for 2 players
        if (this.playerCount !== 2) return;
        
        this.colorTheme = theme;
        document.body.setAttribute('data-theme', theme);

        // Update active color theme button
        document.querySelectorAll('.color-theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            }
        });
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const btn = document.getElementById('sound-toggle-btn');
        
        if (this.soundEnabled) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    getPlayerColor(playerNum) {
        if (this.playerCount === 2 && this.colorTheme !== 'blue-red') {
            // Use theme colors for 2 players
            const themeColors = {
                'green-purple': ['#10b981', '#a855f7'],
                'pink-grey': ['#ec4899', '#6b7280']
            };
            return themeColors[this.colorTheme]?.[playerNum - 1] || this.playerColors[2][playerNum - 1];
        }
        return this.playerColors[this.playerCount][playerNum - 1];
    }

    showMenu() {
        document.getElementById('menu-modal').classList.remove('hidden');
    }

    hideMenu() {
        document.getElementById('menu-modal').classList.add('hidden');
    }

    setupEventListeners() {
        // Welcome screen buttons
        document.getElementById('play-computer-btn').addEventListener('click', () => {
            this.showComputerScreen();
        });

        document.getElementById('play-friends-btn').addEventListener('click', () => {
            this.showStartScreen();
        });

        document.getElementById('play-code-btn').addEventListener('click', () => {
            alert('With Code - Coming Soon!');
        });

        // Computer screen buttons
        document.getElementById('difficulty-prev').addEventListener('click', () => {
            this.changeDifficulty(-1);
        });

        document.getElementById('difficulty-next').addEventListener('click', () => {
            this.changeDifficulty(1);
        });

        document.getElementById('computer-grid-prev').addEventListener('click', () => {
            this.changeComputerGridSize(-1);
        });

        document.getElementById('computer-grid-next').addEventListener('click', () => {
            this.changeComputerGridSize(1);
        });

        document.getElementById('start-computer-game-btn').addEventListener('click', () => {
            this.startComputerGame();
        });

        // Start screen buttons
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });

        // Grid size navigation arrows
        document.getElementById('grid-prev').addEventListener('click', () => {
            this.changeStartGridSize(-1);
        });

        document.getElementById('grid-next').addEventListener('click', () => {
            this.changeStartGridSize(1);
        });

        // Player count navigation arrows
        document.getElementById('player-prev').addEventListener('click', () => {
            this.changePlayerCount(-1);
        });

        document.getElementById('player-next').addEventListener('click', () => {
            this.changePlayerCount(1);
        });

        // Menu buttons
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.showMenu();
        });

        // Score button (no click functionality needed)

        // Menu options
        document.getElementById('resume-btn').addEventListener('click', () => {
            this.hideMenu();
        });

        document.getElementById('restart-game-btn').addEventListener('click', () => {
            this.restartGame();
        });

        document.getElementById('return-home-btn').addEventListener('click', () => {
            this.returnToHome();
        });

        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.restartGame();
        });

        // Win screen buttons
        document.getElementById('win-play-again-btn').addEventListener('click', () => {
            document.getElementById('win-screen').classList.add('hidden');
            this.restartGame();
        });

        document.getElementById('win-main-menu-btn').addEventListener('click', () => {
            document.getElementById('win-screen').classList.add('hidden');
            this.returnToHome();
        });

        // Grid size buttons
        document.querySelectorAll('.grid-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                this.changeGridSize(size);
            });
        });

        // Color theme buttons
        document.querySelectorAll('.color-theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                this.changeColorTheme(theme);
            });
        });

        // Sound toggle button
        document.getElementById('sound-toggle-btn').addEventListener('click', () => {
            this.toggleSound();
        });

        // Close modals when clicking outside
        document.getElementById('game-over-modal').addEventListener('click', (e) => {
            if (e.target.id === 'game-over-modal') {
                document.getElementById('game-over-modal').classList.add('hidden');
            }
        });

        document.getElementById('menu-modal').addEventListener('click', (e) => {
            if (e.target.id === 'menu-modal') {
                this.hideMenu();
            }
        });
    }

    changeStartGridSize(direction) {
        const sizes = [2, 5, 6, 7, 8];
        const currentIndex = sizes.indexOf(this.gridSize);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = sizes.length - 1;
        if (newIndex >= sizes.length) newIndex = 0;
        
        this.gridSize = sizes[newIndex];
        document.getElementById('grid-size-display').textContent = `${this.gridSize}×${this.gridSize}`;
    }

    changePlayerCount(direction) {
        const counts = [2, 3, 4, 5];
        const currentIndex = counts.indexOf(this.playerCount);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = counts.length - 1;
        if (newIndex >= counts.length) newIndex = 0;
        
        this.playerCount = counts[newIndex];
        document.getElementById('player-count-display').textContent = this.playerCount;
    }

    startGame() {
        // Initialize scores for all players
        this.scores = {};
        for (let i = 1; i <= this.playerCount; i++) {
            this.scores[`player${i}`] = 0;
        }
        
        // Hide/show color theme section based on player count
        const colorThemeSection = document.getElementById('color-theme-section');
        if (colorThemeSection) {
            if (this.playerCount > 2) {
                colorThemeSection.style.display = 'none';
            } else {
                colorThemeSection.style.display = 'block';
            }
        }
        
        document.getElementById('start-screen').classList.add('hidden');
        document.querySelector('.game-container').classList.remove('hidden');
        this.initializeGame();
        
        // Start background music
        this.startBackgroundMusic();
    }

    showStartScreen() {
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
    }

    showComputerScreen() {
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('computer-screen').classList.remove('hidden');
    }

    changeDifficulty(direction) {
        const difficulties = ['Easy', 'Medium', 'Hard', 'Expert'];
        const currentIndex = difficulties.findIndex(d => d.toLowerCase() === this.difficulty);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = difficulties.length - 1;
        if (newIndex >= difficulties.length) newIndex = 0;
        
        this.difficulty = difficulties[newIndex].toLowerCase();
        document.getElementById('difficulty-display').textContent = difficulties[newIndex];
    }

    changeComputerGridSize(direction) {
        const sizes = [2, 5, 6, 7, 8];
        const currentIndex = sizes.indexOf(this.gridSize);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = sizes.length - 1;
        if (newIndex >= sizes.length) newIndex = 0;
        
        this.gridSize = sizes[newIndex];
        document.getElementById('computer-grid-size-display').textContent = `${this.gridSize}×${this.gridSize}`;
    }

    startComputerGame() {
        // Set to 2 players and bot mode
        this.playerCount = 2;
        this.gameMode = 'bot';
        
        // Initialize scores for 2 players
        this.scores = {
            player1: 0,
            player2: 0
        };
        
        // Hide/show color theme section (show for 2 players)
        const colorThemeSection = document.getElementById('color-theme-section');
        if (colorThemeSection) {
            colorThemeSection.style.display = 'block';
        }
        
        document.getElementById('computer-screen').classList.add('hidden');
        document.querySelector('.game-container').classList.remove('hidden');
        this.initializeGame();
        
        // Start background music
        this.startBackgroundMusic();
    }

    returnToHome() {
        // Reset game state
        this.currentPlayer = 1;
        this.scores = {};
        this.lines.clear();
        this.drawnLines.clear();
        this.lastDrawnLine = null;
        this.boxes = [];
        this.gameOver = false;
        this.gameStarted = false;
        this.gameMode = '2player';
        this.difficulty = 'easy';

        // Clear any existing turn text timeout
        if (this.turnTextTimeout) {
            clearTimeout(this.turnTextTimeout);
            this.turnTextTimeout = null;
        }

        // Hide all modals and game container
        document.getElementById('menu-modal').classList.add('hidden');
        document.getElementById('game-over-modal').classList.add('hidden');
        document.querySelector('.game-container').classList.add('hidden');
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('computer-screen').classList.add('hidden');
        
        // Show welcome screen
        document.getElementById('welcome-screen').classList.remove('hidden');
        
        // Reset body class
        document.body.className = '';
        document.body.removeAttribute('data-player-count');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PinsGame();
});