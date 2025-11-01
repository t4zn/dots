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
        this.botMakingMove = false; // Track if bot is currently making a move
        this.difficulty = 'easy'; // 'easy', 'medium', 'hard'
        this.audioContext = null; // Audio context for sound effects
        this.soundEnabled = true; // Sound effects toggle
        
        // Online multiplayer properties
        this.isOnlineMode = false;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        this.roomPlayers = [];
        this.previousPlayerCount = 0;
        this.roomSettings = {
            playerCount: 2,
            gridSize: 6
        };
        this.gameState = null;
        this.onlineGameStarted = false;
        this.startGameTimeout = null;
        
        // Settings properties
        this.playerName = 'Player';
        this.selectedCountry = { code: 'US', name: 'United States', flag: '🇺🇸' };
        this.volume = 100;
        
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

        // Load cached settings (without UI updates)
        this.loadCachedSettings(false);
        
        this.setupEventListeners();
        this.initAudio();
        this.cleanupOldRooms();
        
        // Update UI after DOM is ready
        setTimeout(() => {
            this.updateUIWithCachedSettings();
            
            // Additional settings button setup as fallback
            const settingsBtn = document.getElementById('settings-btn');
            if (settingsBtn && !settingsBtn.hasAttribute('data-listener-added')) {
                settingsBtn.setAttribute('data-listener-added', 'true');
                settingsBtn.onclick = (e) => {
                    console.log('Settings button clicked via onclick');
                    e.preventDefault();
                    e.stopPropagation();
                    this.showSettings();
                };
            }
        }, 100);
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
        // Check if sound is enabled and volume is not zero
        if (!this.soundEnabled || this.volume === 0) {
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
        
        const volume = (this.volume / 100) * 0.12;
        gain.gain.setValueAtTime(volume, now);
        
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
        
        const volume = (this.volume / 100) * 0.2;
        gain.gain.setValueAtTime(volume, now);
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
            const volume = (this.volume / 100) * 0.15;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
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
        
        const finalVolume = (this.volume / 100) * 0.2;
        finalGain.gain.setValueAtTime(0, now + 0.3);
        finalGain.gain.linearRampToValueAtTime(finalVolume, now + 0.35);
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

    async drawLine(lineElement) {
        console.log('DrawLine called for player:', this.currentPlayer, 'botMakingMove:', this.botMakingMove);
        
        if (this.gameOver || lineElement.classList.contains('drawn')) {
            console.log('Game over or line already drawn');
            return;
        }

        // In bot mode, only allow human player (player 1) to make moves manually
        // Unless it's the bot making the move
        if (this.gameMode === 'bot' && this.currentPlayer === 2 && !this.botMakingMove) {
            console.log('Blocking manual move for bot player');
            return;
        }

        // In online mode, check if it's this player's turn
        if (this.gameMode === 'online') {
            const canMove = await this.makeOnlineMove(lineElement);
            if (!canMove) {
                return;
            }
        }

        console.log('Drawing line for player:', this.currentPlayer);
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

        // Sync game state in online mode
        if (this.gameMode === 'online') {
            this.syncGameState().catch(console.error);
        }

        // Trigger bot move if it's bot's turn (including extra turns)
        if (this.gameMode === 'bot' && this.currentPlayer === 2 && !this.gameOver && !this.botThinking) {
            console.log('Triggering bot move - extra turn:', playerGetsAnotherTurn);
            setTimeout(() => this.botMove(), playerGetsAnotherTurn ? 300 : 100);
        }
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
        
        // If no more chains found and it's bot's turn, trigger next move
        if (this.gameMode === 'bot' && this.currentPlayer === 2 && !this.gameOver && !this.botThinking) {
            console.log('Auto-complete chain finished, triggering bot move');
            setTimeout(() => this.botMove(), 400);
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
            
            // Trigger bot move if it's bot's turn after auto-complete
            if (this.gameMode === 'bot' && this.currentPlayer === 2 && !this.gameOver && !this.botThinking) {
                console.log('Triggering bot move after auto-complete chain');
                setTimeout(() => this.botMove(), 200);
            }
        }

        this.checkGameEnd();
    }

    showTurnDisplay() {
        // Clear any existing timeout
        if (this.turnTextTimeout) {
            clearTimeout(this.turnTextTimeout);
        }

        const turnDisplay = document.getElementById('turn-display');
        
        // Update text based on game mode
        if (this.gameMode === 'bot') {
            turnDisplay.textContent = this.currentPlayer === 1 ? 'YOUR TURN' : "BOT'S TURN";
        } else if (this.gameMode === 'online') {
            const myPlayerNumber = this.roomPlayers.find(p => p.id === this.playerId)?.playerNumber;
            turnDisplay.textContent = this.currentPlayer === myPlayerNumber ? 'YOUR TURN' : `PLAYER ${this.currentPlayer}'S TURN`;
        } else {
            turnDisplay.textContent = 'YOUR TURN';
        }

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
            
            // Get color name - in bot mode, show YOU vs BOT, in online mode show player names
            if (this.gameMode === 'bot') {
                winColorName = winningPlayer === 1 ? 'YOU' : 'BOT';
            } else if (this.gameMode === 'online') {
                const myPlayerNumber = this.roomPlayers.find(p => p.id === this.playerId)?.playerNumber;
                winColorName = winningPlayer === myPlayerNumber ? 'YOU' : `PLAYER ${winningPlayer}`;
            } else {
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
            }
        } else {
            winColor = '#636e72';
            winColorName = 'DRAW';
        }

        // Play win sound
        this.playSound('win');
        
        // Show fullscreen win message
        winScreen.style.background = winColor;
        
        // Set win text based on result
        if (winners.length === 1) {
            if (this.gameMode === 'bot') {
                winText.innerHTML = winningPlayer === 1 ? 'YOU<br>WIN' : 'BOT<br>WINS';
            } else if (this.gameMode === 'online') {
                const myPlayerNumber = this.roomPlayers.find(p => p.id === this.playerId)?.playerNumber;
                winText.innerHTML = winningPlayer === myPlayerNumber ? 'YOU<br>WIN' : `PLAYER ${winningPlayer}<br>WINS`;
            } else {
                winText.innerHTML = `PLAYER ${winningPlayer}<br>WINS`;
            }
        } else {
            winText.innerHTML = 'DRAW'; // Just "DRAW"
        }
        
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
        
        this.saveCachedSettings();
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const btn = document.getElementById('sound-toggle-btn');
        
        if (this.soundEnabled) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        
        this.saveCachedSettings();
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
        // Show room code in menu if in online mode
        const menuRoomCodeSection = document.getElementById('menu-room-code-section');
        if (this.isOnlineMode && this.roomCode && menuRoomCodeSection) {
            menuRoomCodeSection.style.display = 'block';
            document.getElementById('menu-room-code-text').textContent = this.roomCode;
        } else if (menuRoomCodeSection) {
            menuRoomCodeSection.style.display = 'none';
        }
        
        document.getElementById('menu-modal').classList.remove('hidden');
    }

    hideMenu() {
        document.getElementById('menu-modal').classList.add('hidden');
    }

    // Online Multiplayer Methods
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    generateTempId() {
        // Generate a temporary ID based on browser fingerprint for reconnection
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Browser fingerprint', 2, 2);
        return canvas.toDataURL().slice(-10);
    }

    joinOngoingGame(roomData) {
        // Set up game state for joining ongoing game
        this.playerCount = roomData.settings.playerCount;
        this.gridSize = roomData.settings.gridSize;
        this.gameMode = 'online';
        this.onlineGameStarted = true;
        
        // Load existing game state
        if (roomData.gameState) {
            this.loadGameState(roomData.gameState);
        } else {
            // Initialize scores for all players
            this.scores = {};
            for (let i = 1; i <= this.playerCount; i++) {
                this.scores[`player${i}`] = 0;
            }
        }
        
        // Show game screen
        document.getElementById('join-room-screen').classList.add('hidden');
        document.getElementById('room-lobby-screen').classList.add('hidden');
        document.querySelector('.game-container').classList.remove('hidden');
        this.initializeGame();
        
        // Start polling for game updates
        if (this.lobbyInterval) {
            clearInterval(this.lobbyInterval);
        }
        this.gameInterval = setInterval(async () => {
            await this.pollForUpdates();
        }, 500);
        
        this.showNotification('Joined ongoing game!');
    }

    cleanupOldRooms() {
        // Clean up rooms older than 1 hour
        const oneHour = 60 * 60 * 1000;
        const now = Date.now();
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('room_')) {
                try {
                    const roomData = JSON.parse(localStorage.getItem(key));
                    if (roomData && roomData.created && (now - roomData.created) > oneHour) {
                        localStorage.removeItem(key);
                        i--; // Adjust index since we removed an item
                    }
                } catch (e) {
                    // Invalid room data, remove it
                    localStorage.removeItem(key);
                    i--;
                }
            }
        }
    }

    // Caching Methods
    loadCachedSettings(updateUI = true) {
        try {
            const cachedSettings = localStorage.getItem('dotsBoxesSettings');
            if (cachedSettings) {
                const settings = JSON.parse(cachedSettings);
                
                // Load game settings
                this.gridSize = settings.gridSize || 6;
                this.playerCount = settings.playerCount || 2;
                this.difficulty = settings.difficulty || 'easy';
                this.colorTheme = settings.colorTheme || 'blue-red';
                this.soundEnabled = settings.soundEnabled !== undefined ? settings.soundEnabled : true;
                
                // Load user settings
                this.playerName = settings.playerName || 'Player';
                this.selectedCountry = settings.selectedCountry || { code: 'US', name: 'United States', flag: '🇺🇸' };
                this.volume = settings.volume !== undefined ? settings.volume : 100;
                
                // Load room settings
                this.roomSettings = {
                    playerCount: settings.roomPlayerCount || 2,
                    gridSize: settings.roomGridSize || 6
                };
                
                // Update UI elements with cached values only if requested
                if (updateUI) {
                    this.updateUIWithCachedSettings();
                }
            }
        } catch (e) {
            console.warn('Failed to load cached settings:', e);
        }
    }

    saveCachedSettings() {
        try {
            const settings = {
                gridSize: this.gridSize,
                playerCount: this.playerCount,
                difficulty: this.difficulty,
                colorTheme: this.colorTheme,
                soundEnabled: this.soundEnabled,
                playerName: this.playerName,
                selectedCountry: this.selectedCountry,
                volume: this.volume,
                roomPlayerCount: this.roomSettings.playerCount,
                roomGridSize: this.roomSettings.gridSize,
                lastUpdated: Date.now()
            };
            
            localStorage.setItem('dotsBoxesSettings', JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    updateDifficultyColor(difficultyDisplay) {
        // Remove all difficulty color classes
        difficultyDisplay.classList.remove('difficulty-easy', 'difficulty-medium', 'difficulty-hard', 'difficulty-expert');
        
        // Add the appropriate color class based on current difficulty
        difficultyDisplay.classList.add(`difficulty-${this.difficulty}`);
    }

    updateUIWithCachedSettings() {
        // Update main game settings displays
        const gridDisplay = document.getElementById('grid-size-display');
        if (gridDisplay) {
            gridDisplay.textContent = `${this.gridSize}×${this.gridSize}`;
        }
        
        const playerDisplay = document.getElementById('player-count-display');
        if (playerDisplay) {
            playerDisplay.textContent = this.playerCount;
        }
        
        const computerGridDisplay = document.getElementById('computer-grid-size-display');
        if (computerGridDisplay) {
            computerGridDisplay.textContent = `${this.gridSize}×${this.gridSize}`;
        }
        
        const difficultyDisplay = document.getElementById('difficulty-display');
        if (difficultyDisplay) {
            const difficulties = ['Easy', 'Medium', 'Hard', 'Expert'];
            const difficultyIndex = ['easy', 'medium', 'hard', 'expert'].indexOf(this.difficulty);
            difficultyDisplay.textContent = difficulties[difficultyIndex] || 'Easy';
            
            // Update difficulty color class
            this.updateDifficultyColor(difficultyDisplay);
        }
        
        // Update room settings displays
        const roomPlayerDisplay = document.getElementById('room-player-count-display');
        if (roomPlayerDisplay) {
            roomPlayerDisplay.textContent = this.roomSettings.playerCount;
        }
        
        const roomGridDisplay = document.getElementById('room-grid-size-display');
        if (roomGridDisplay) {
            roomGridDisplay.textContent = `${this.roomSettings.gridSize}×${this.roomSettings.gridSize}`;
        }
        
        // Update color theme
        document.body.setAttribute('data-theme', this.colorTheme);
        document.querySelectorAll('.color-theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === this.colorTheme) {
                btn.classList.add('active');
            }
        });
        
        // Update sound toggle
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            if (this.soundEnabled) {
                soundBtn.classList.add('active');
            } else {
                soundBtn.classList.remove('active');
            }
        }
    }

    // Settings Methods
    getCountriesData() {
        return [
            { code: 'AF', name: 'Afghanistan', flag: '🇦🇫' },
            { code: 'AL', name: 'Albania', flag: '🇦🇱' },
            { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
            { code: 'AD', name: 'Andorra', flag: '🇦🇩' },
            { code: 'AO', name: 'Angola', flag: '🇦🇴' },
            { code: 'AG', name: 'Antigua and Barbuda', flag: '🇦🇬' },
            { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
            { code: 'AM', name: 'Armenia', flag: '🇦🇲' },
            { code: 'AU', name: 'Australia', flag: '🇦🇺' },
            { code: 'AT', name: 'Austria', flag: '🇦🇹' },
            { code: 'AZ', name: 'Azerbaijan', flag: '🇦🇿' },
            { code: 'BS', name: 'Bahamas', flag: '🇧🇸' },
            { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
            { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
            { code: 'BB', name: 'Barbados', flag: '🇧🇧' },
            { code: 'BY', name: 'Belarus', flag: '🇧🇾' },
            { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
            { code: 'BZ', name: 'Belize', flag: '🇧🇿' },
            { code: 'BJ', name: 'Benin', flag: '🇧🇯' },
            { code: 'BT', name: 'Bhutan', flag: '🇧🇹' },
            { code: 'BO', name: 'Bolivia', flag: '🇧🇴' },
            { code: 'BA', name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
            { code: 'BW', name: 'Botswana', flag: '🇧🇼' },
            { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
            { code: 'BN', name: 'Brunei', flag: '🇧🇳' },
            { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
            { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
            { code: 'BI', name: 'Burundi', flag: '🇧🇮' },
            { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻' },
            { code: 'KH', name: 'Cambodia', flag: '🇰🇭' },
            { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
            { code: 'CA', name: 'Canada', flag: '🇨🇦' },
            { code: 'CF', name: 'Central African Republic', flag: '🇨🇫' },
            { code: 'TD', name: 'Chad', flag: '🇹🇩' },
            { code: 'CL', name: 'Chile', flag: '🇨🇱' },
            { code: 'CN', name: 'China', flag: '🇨🇳' },
            { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
            { code: 'KM', name: 'Comoros', flag: '🇰🇲' },
            { code: 'CG', name: 'Congo', flag: '🇨🇬' },
            { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
            { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
            { code: 'CU', name: 'Cuba', flag: '🇨🇺' },
            { code: 'CY', name: 'Cyprus', flag: '🇨🇾' },
            { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
            { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
            { code: 'DJ', name: 'Djibouti', flag: '🇩🇯' },
            { code: 'DM', name: 'Dominica', flag: '🇩🇲' },
            { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴' },
            { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
            { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
            { code: 'SV', name: 'El Salvador', flag: '🇸🇻' },
            { code: 'GQ', name: 'Equatorial Guinea', flag: '🇬🇶' },
            { code: 'ER', name: 'Eritrea', flag: '🇪🇷' },
            { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
            { code: 'SZ', name: 'Eswatini', flag: '🇸🇿' },
            { code: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
            { code: 'FJ', name: 'Fiji', flag: '🇫🇯' },
            { code: 'FI', name: 'Finland', flag: '🇫🇮' },
            { code: 'FR', name: 'France', flag: '🇫🇷' },
            { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
            { code: 'GM', name: 'Gambia', flag: '🇬🇲' },
            { code: 'GE', name: 'Georgia', flag: '🇬🇪' },
            { code: 'DE', name: 'Germany', flag: '🇩🇪' },
            { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
            { code: 'GR', name: 'Greece', flag: '🇬🇷' },
            { code: 'GD', name: 'Grenada', flag: '🇬🇩' },
            { code: 'GT', name: 'Guatemala', flag: '🇬🇹' },
            { code: 'GN', name: 'Guinea', flag: '🇬🇳' },
            { code: 'GW', name: 'Guinea-Bissau', flag: '🇬🇼' },
            { code: 'GY', name: 'Guyana', flag: '🇬🇾' },
            { code: 'HT', name: 'Haiti', flag: '🇭🇹' },
            { code: 'HN', name: 'Honduras', flag: '🇭🇳' },
            { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
            { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
            { code: 'IN', name: 'India', flag: '🇮🇳' },
            { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
            { code: 'IR', name: 'Iran', flag: '🇮🇷' },
            { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
            { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
            { code: 'IL', name: 'Israel', flag: '🇮🇱' },
            { code: 'IT', name: 'Italy', flag: '🇮🇹' },
            { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
            { code: 'JP', name: 'Japan', flag: '🇯🇵' },
            { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
            { code: 'KZ', name: 'Kazakhstan', flag: '🇰🇿' },
            { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
            { code: 'KI', name: 'Kiribati', flag: '🇰🇮' },
            { code: 'KP', name: 'North Korea', flag: '🇰🇵' },
            { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
            { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
            { code: 'KG', name: 'Kyrgyzstan', flag: '🇰🇬' },
            { code: 'LA', name: 'Laos', flag: '🇱🇦' },
            { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
            { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
            { code: 'LS', name: 'Lesotho', flag: '🇱🇸' },
            { code: 'LR', name: 'Liberia', flag: '🇱🇷' },
            { code: 'LY', name: 'Libya', flag: '🇱🇾' },
            { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮' },
            { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
            { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
            { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
            { code: 'MW', name: 'Malawi', flag: '🇲🇼' },
            { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
            { code: 'MV', name: 'Maldives', flag: '🇲🇻' },
            { code: 'ML', name: 'Mali', flag: '🇲🇱' },
            { code: 'MT', name: 'Malta', flag: '🇲🇹' },
            { code: 'MH', name: 'Marshall Islands', flag: '🇲🇭' },
            { code: 'MR', name: 'Mauritania', flag: '🇲🇷' },
            { code: 'MU', name: 'Mauritius', flag: '🇲🇺' },
            { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
            { code: 'FM', name: 'Micronesia', flag: '🇫🇲' },
            { code: 'MD', name: 'Moldova', flag: '🇲🇩' },
            { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
            { code: 'MN', name: 'Mongolia', flag: '🇲🇳' },
            { code: 'ME', name: 'Montenegro', flag: '🇲🇪' },
            { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
            { code: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
            { code: 'MM', name: 'Myanmar', flag: '🇲🇲' },
            { code: 'NA', name: 'Namibia', flag: '🇳🇦' },
            { code: 'NR', name: 'Nauru', flag: '🇳🇷' },
            { code: 'NP', name: 'Nepal', flag: '🇳🇵' },
            { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
            { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
            { code: 'NI', name: 'Nicaragua', flag: '🇳🇮' },
            { code: 'NE', name: 'Niger', flag: '🇳🇪' },
            { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
            { code: 'MK', name: 'North Macedonia', flag: '🇲🇰' },
            { code: 'NO', name: 'Norway', flag: '🇳🇴' },
            { code: 'OM', name: 'Oman', flag: '🇴🇲' },
            { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
            { code: 'PW', name: 'Palau', flag: '🇵🇼' },
            { code: 'PA', name: 'Panama', flag: '🇵🇦' },
            { code: 'PG', name: 'Papua New Guinea', flag: '🇵🇬' },
            { code: 'PY', name: 'Paraguay', flag: '🇵🇾' },
            { code: 'PE', name: 'Peru', flag: '🇵🇪' },
            { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
            { code: 'PL', name: 'Poland', flag: '🇵🇱' },
            { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
            { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
            { code: 'RO', name: 'Romania', flag: '🇷🇴' },
            { code: 'RU', name: 'Russia', flag: '🇷🇺' },
            { code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
            { code: 'KN', name: 'Saint Kitts and Nevis', flag: '🇰🇳' },
            { code: 'LC', name: 'Saint Lucia', flag: '🇱🇨' },
            { code: 'VC', name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' },
            { code: 'WS', name: 'Samoa', flag: '🇼🇸' },
            { code: 'SM', name: 'San Marino', flag: '🇸🇲' },
            { code: 'ST', name: 'Sao Tome and Principe', flag: '🇸🇹' },
            { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
            { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
            { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
            { code: 'SC', name: 'Seychelles', flag: '🇸🇨' },
            { code: 'SL', name: 'Sierra Leone', flag: '🇸🇱' },
            { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
            { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
            { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
            { code: 'SB', name: 'Solomon Islands', flag: '🇸🇧' },
            { code: 'SO', name: 'Somalia', flag: '🇸🇴' },
            { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
            { code: 'SS', name: 'South Sudan', flag: '🇸🇸' },
            { code: 'ES', name: 'Spain', flag: '🇪🇸' },
            { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
            { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
            { code: 'SR', name: 'Suriname', flag: '🇸🇷' },
            { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
            { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
            { code: 'SY', name: 'Syria', flag: '🇸🇾' },
            { code: 'TJ', name: 'Tajikistan', flag: '🇹🇯' },
            { code: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
            { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
            { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱' },
            { code: 'TG', name: 'Togo', flag: '🇹🇬' },
            { code: 'TO', name: 'Tonga', flag: '🇹🇴' },
            { code: 'TT', name: 'Trinidad and Tobago', flag: '🇹🇹' },
            { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
            { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
            { code: 'TM', name: 'Turkmenistan', flag: '🇹🇲' },
            { code: 'TV', name: 'Tuvalu', flag: '🇹🇻' },
            { code: 'UG', name: 'Uganda', flag: '🇺🇬' },
            { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
            { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
            { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
            { code: 'US', name: 'United States', flag: '🇺🇸' },
            { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
            { code: 'UZ', name: 'Uzbekistan', flag: '🇺🇿' },
            { code: 'VU', name: 'Vanuatu', flag: '🇻🇺' },
            { code: 'VA', name: 'Vatican City', flag: '🇻🇦' },
            { code: 'VE', name: 'Venezuela', flag: '🇻🇪' },
            { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
            { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
            { code: 'ZM', name: 'Zambia', flag: '🇿🇲' },
            { code: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' }
        ];
    }

    showSettings() {
        console.log('showSettings called');
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            // Force display with inline styles for debugging
            modal.style.display = 'flex';
            modal.style.zIndex = '99999';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.background = 'rgba(0, 0, 0, 0.8)';
            
            this.populateCountryDropdown();
            this.updateSettingsUI();
            console.log('Settings modal shown with inline styles');
            console.log('Modal computed style:', window.getComputedStyle(modal).display);
        } else {
            console.error('Settings modal not found');
        }
    }

    hideSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        
        const dropdown = document.getElementById('country-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

    populateCountryDropdown() {
        const countries = this.getCountriesData();
        this.allCountries = countries;
        this.renderCountryList(countries);
        
        // Set up search functionality
        const searchInput = document.getElementById('country-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredCountries = countries.filter(country => 
                    country.name.toLowerCase().includes(searchTerm)
                );
                this.renderCountryList(filteredCountries);
            });
        }
    }

    renderCountryList(countries) {
        const countryList = document.getElementById('country-list');
        if (!countryList) return;
        
        countryList.innerHTML = '';
        countries.forEach(country => {
            const option = document.createElement('div');
            option.className = 'country-option';
            option.innerHTML = `
                <span class="flag-emoji">${country.flag}</span>
                <span>${country.name}</span>
            `;
            option.addEventListener('click', () => {
                this.selectCountry(country);
            });
            countryList.appendChild(option);
        });
    }

    selectCountry(country) {
        this.selectedCountry = country;
        document.getElementById('selected-flag').textContent = country.flag;
        document.getElementById('selected-country').textContent = country.name;
        document.getElementById('country-dropdown').classList.add('hidden');
        document.getElementById('country-btn').classList.remove('open');
        this.saveCachedSettings();
    }

    updateSettingsUI() {
        // Update player name
        document.getElementById('player-name-input').value = this.playerName;
        
        // Update country selection
        document.getElementById('selected-flag').textContent = this.selectedCountry.flag;
        document.getElementById('selected-country').textContent = this.selectedCountry.name;
        
        // Update volume
        document.getElementById('volume-slider').value = this.volume;
        document.getElementById('volume-value').textContent = `${this.volume}%`;
    }

    updateVolume(value) {
        this.volume = parseInt(value);
        document.getElementById('volume-value').textContent = `${this.volume}%`;
        this.saveCachedSettings();
        
        // Update audio context volume if available
        if (this.audioContext && this.audioContext.state === 'running') {
            // Volume will be applied to individual sounds
        }
    }

    updatePlayerName(name) {
        this.playerName = name.trim() || 'Player';
        this.saveCachedSettings();
    }

    showPrivacy() {
        const modal = document.getElementById('privacy-modal');
        if (modal) {
            // Force remove hidden class first
            modal.classList.remove('hidden');
            
            // Force all styles to ensure it appears on top
            modal.style.display = 'flex !important';
            modal.style.zIndex = '999999';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.background = 'rgba(0, 0, 0, 0.8)';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            
            // Ensure settings modal is behind
            const settingsModal = document.getElementById('settings-modal');
            if (settingsModal) {
                settingsModal.style.zIndex = '10000';
            }
            
            console.log('Privacy modal forced to top with z-index 999999');
        }
    }

    hidePrivacy() {
        const modal = document.getElementById('privacy-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    isMobileDevice() {
        // Check if device is mobile
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // Check for mobile user agents
        const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
        
        // Also check screen width as backup
        const isMobileWidth = window.innerWidth <= 768;
        
        // Check for touch capability
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        return mobileRegex.test(userAgent) || (isMobileWidth && isTouchDevice);
    }



    cacheRecentRoomCode(roomCode) {
        try {
            let recentRooms = JSON.parse(localStorage.getItem('dotsBoxesRecentRooms') || '[]');
            
            // Remove if already exists
            recentRooms = recentRooms.filter(code => code !== roomCode);
            
            // Add to beginning
            recentRooms.unshift(roomCode);
            
            // Keep only last 5 room codes
            recentRooms = recentRooms.slice(0, 5);
            
            localStorage.setItem('dotsBoxesRecentRooms', JSON.stringify(recentRooms));
        } catch (e) {
            console.warn('Failed to cache room code:', e);
        }
    }

    getRecentRoomCodes() {
        try {
            return JSON.parse(localStorage.getItem('dotsBoxesRecentRooms') || '[]');
        } catch (e) {
            return [];
        }
    }

    async createRoom() {
        this.roomCode = this.generateRoomCode();
        this.playerId = this.generatePlayerId();
        this.isHost = true;
        this.isOnlineMode = true;
        
        // Cache the room code for quick access
        this.cacheRecentRoomCode(this.roomCode);
        
        // Initialize room with host player
        this.roomPlayers = [{
            id: this.playerId,
            name: this.playerName || 'Host',
            isHost: true,
            playerNumber: 1,
            tempId: this.generateTempId()
        }];
        
        console.log('Room created. Host player ID:', this.playerId, 'isHost:', this.isHost);
        
        // Store room data on server
        const roomData = {
            code: this.roomCode,
            host: this.playerId,
            players: this.roomPlayers,
            settings: {
                playerCount: this.roomSettings.playerCount,
                gridSize: this.roomSettings.gridSize
            },
            gameState: null,
            gameStarted: false,
            currentPlayer: 1,
            created: Date.now()
        };
        
        await this.updateRoomData(roomData);
        
        this.showRoomLobby();
    }

    async joinRoom(roomCode) {
        const roomData = await this.getRoomData(roomCode);
        
        if (!roomData) {
            alert('Room not found! Please check the room code.');
            return false;
        }
        
        // Check if player is already in the room (reconnection case)
        const tempId = this.generateTempId();
        const existingPlayer = roomData.players.find(p => 
            (p.name === this.playerName && this.playerName !== 'Player') || 
            p.tempId === tempId
        );
        
        if (existingPlayer) {
            // Reconnect to existing slot
            this.roomCode = roomCode;
            this.playerId = existingPlayer.id;
            this.isHost = existingPlayer.isHost;
            this.isOnlineMode = true;
            this.roomSettings = roomData.settings;
            this.roomPlayers = roomData.players;
            
            // If game already started, join the ongoing game
            if (roomData.gameStarted) {
                this.joinOngoingGame(roomData);
            } else {
                this.showRoomLobby();
            }
            
            this.cacheRecentRoomCode(roomCode);
            
            // Immediately check room status
            setTimeout(async () => {
                await this.updateLobbyDisplay();
            }, 100);
            
            return true;
        }
        
        if (roomData.players.length >= roomData.settings.playerCount) {
            alert('Room is full!');
            return false;
        }
        
        // Allow joining even if game started but there's space (for reconnections)
        this.roomCode = roomCode;
        this.playerId = this.generatePlayerId();
        this.isHost = false;
        this.isOnlineMode = true;
        this.roomSettings = roomData.settings;
        
        // Add player to room
        const newPlayer = {
            id: this.playerId,
            name: this.playerName || `Player ${roomData.players.length + 1}`,
            isHost: false,
            playerNumber: roomData.players.length + 1,
            tempId: this.generateTempId()
        };
        
        roomData.players.push(newPlayer);
        this.roomPlayers = roomData.players;
        
        // Update room data
        await this.updateRoomData(roomData);
        
        // If game already started, join the ongoing game
        if (roomData.gameStarted) {
            this.joinOngoingGame(roomData);
        } else {
            this.showRoomLobby();
        }
        
        // Cache the room code for quick access
        this.cacheRecentRoomCode(roomCode);
        
        // Immediately check if game should start (for host) or if game already started
        setTimeout(async () => {
            await this.updateLobbyDisplay();
        }, 100);
        
        return true;
    }

    async getRoomData(roomCode) {
        try {
            // Use JSONBin for cross-device room sharing
            const response = await fetch(`https://api.jsonbin.io/v3/b/6740a1e5ad19ca34f8c8f123/latest`, {
                headers: {
                    'X-Master-Key': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.record && data.record.rooms && data.record.rooms[roomCode]) {
                    return data.record.rooms[roomCode];
                }
            }
        } catch (error) {
            console.log('Server fetch failed, using localStorage:', error);
        }
        
        // Fallback to localStorage for same-device testing
        const data = localStorage.getItem(`room_${roomCode}`);
        return data ? JSON.parse(data) : null;
    }

    async updateRoomData(roomData) {
        try {
            // Get current data first
            const currentResponse = await fetch(`https://api.jsonbin.io/v3/b/6740a1e5ad19ca34f8c8f123/latest`, {
                headers: {
                    'X-Master-Key': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
                }
            });
            
            let allRooms = {};
            if (currentResponse.ok) {
                const currentData = await currentResponse.json();
                allRooms = currentData.record?.rooms || {};
            }
            
            // Update with new room data
            allRooms[this.roomCode] = roomData;
            
            // Update JSONBin with all rooms
            const response = await fetch(`https://api.jsonbin.io/v3/b/6740a1e5ad19ca34f8c8f123`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
                },
                body: JSON.stringify({ rooms: allRooms })
            });
            
            if (!response.ok) {
                throw new Error('JSONBin update failed');
            }
        } catch (error) {
            console.log('Server update failed, using localStorage:', error);
        }
        
        // Always update localStorage as backup
        localStorage.setItem(`room_${this.roomCode}`, JSON.stringify(roomData));
    }

    async leaveRoom() {
        if (!this.roomCode) return;
        
        const roomData = await this.getRoomData(this.roomCode);
        if (roomData) {
            // Remove player from room
            roomData.players = roomData.players.filter(p => p.id !== this.playerId);
            
            if (roomData.players.length === 0) {
                // Delete empty room from server
                try {
                    const currentResponse = await fetch(`https://api.jsonbin.io/v3/b/6740a1e5ad19ca34f8c8f123/latest`, {
                        headers: {
                            'X-Master-Key': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
                        }
                    });
                    
                    if (currentResponse.ok) {
                        const currentData = await currentResponse.json();
                        const allRooms = currentData.record?.rooms || {};
                        delete allRooms[this.roomCode];
                        
                        await fetch(`https://api.jsonbin.io/v3/b/6740a1e5ad19ca34f8c8f123`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Master-Key': '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
                            },
                            body: JSON.stringify({ rooms: allRooms })
                        });
                    }
                } catch (error) {
                    console.log('Failed to delete room from server:', error);
                }
                localStorage.removeItem(`room_${this.roomCode}`);
            } else {
                // If host left, make next player host
                if (this.isHost && roomData.players.length > 0) {
                    roomData.players[0].isHost = true;
                    roomData.host = roomData.players[0].id;
                }
                await this.updateRoomData(roomData);
            }
        }
        
        this.resetOnlineState();
    }

    resetOnlineState() {
        this.isOnlineMode = false;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        this.roomPlayers = [];
        this.gameState = null;
        this.onlineGameStarted = false;
        
        // Clean up timeouts and intervals
        if (this.startGameTimeout) {
            clearTimeout(this.startGameTimeout);
            this.startGameTimeout = null;
        }
        if (this.lobbyInterval) {
            clearInterval(this.lobbyInterval);
            this.lobbyInterval = null;
        }
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
    }

    async startOnlineGame() {
        if (!this.isHost) return;
        
        const roomData = await this.getRoomData(this.roomCode);
        if (!roomData) return;
        
        if (roomData.players.length !== roomData.settings.playerCount) {
            alert(`Need ${roomData.settings.playerCount} players to start!`);
            return;
        }
        
        // Initialize game state
        this.playerCount = roomData.settings.playerCount;
        this.gridSize = roomData.settings.gridSize;
        this.gameMode = 'online';
        this.onlineGameStarted = true;
        
        // Initialize scores for all players
        this.scores = {};
        for (let i = 1; i <= this.playerCount; i++) {
            this.scores[`player${i}`] = 0;
        }
        
        // Mark game as started
        roomData.gameStarted = true;
        roomData.gameState = {
            currentPlayer: 1,
            scores: this.scores,
            lines: [],
            drawnLines: {},
            boxes: []
        };
        
        this.updateRoomData(roomData);
        
        // Start the game
        document.getElementById('room-lobby-screen').classList.add('hidden');
        document.querySelector('.game-container').classList.remove('hidden');
        this.initializeGame();
        
        // Start polling for game updates
        if (this.lobbyInterval) {
            clearInterval(this.lobbyInterval);
        }
        this.gameInterval = setInterval(async () => {
            await this.pollForUpdates();
        }, 500);
    }

    async makeOnlineMove(lineElement) {
        if (!this.isOnlineMode || !this.onlineGameStarted) return false;
        
        const roomData = await this.getRoomData(this.roomCode);
        if (!roomData) return false;
        
        // Check if it's this player's turn
        const myPlayerNumber = this.roomPlayers.find(p => p.id === this.playerId)?.playerNumber;
        if (roomData.gameState.currentPlayer !== myPlayerNumber) {
            alert("It's not your turn!");
            return false;
        }
        
        return true;
    }

    async syncGameState() {
        if (!this.isOnlineMode) return;
        
        const roomData = await this.getRoomData(this.roomCode);
        if (!roomData || !roomData.gameState) return;
        
        // Update game state to server
        roomData.gameState = {
            currentPlayer: this.currentPlayer,
            scores: this.scores,
            lines: Array.from(this.lines),
            drawnLines: Object.fromEntries(this.drawnLines),
            gameOver: this.gameOver
        };
        
        await this.updateRoomData(roomData);
    }

    async pollForUpdates() {
        if (!this.isOnlineMode || !this.onlineGameStarted) return;
        
        const roomData = await this.getRoomData(this.roomCode);
        if (!roomData || !roomData.gameState) return;
        
        // Check for game state changes from other players
        const serverState = roomData.gameState;
        
        // Update current player
        if (serverState.currentPlayer !== this.currentPlayer) {
            this.currentPlayer = serverState.currentPlayer;
            this.updateUI();
        }
        
        // Update scores
        if (JSON.stringify(serverState.scores) !== JSON.stringify(this.scores)) {
            this.scores = { ...serverState.scores };
            this.updateUI();
        }
        
        // Update lines (simplified - in real implementation would need more sophisticated sync)
        if (serverState.lines.length !== this.lines.size) {
            // Redraw game state
            this.loadGameState(serverState);
        }
    }

    loadGameState(gameState) {
        // Load lines
        this.lines = new Set(gameState.lines);
        this.drawnLines = new Map(Object.entries(gameState.drawnLines));
        
        // Redraw all lines
        document.querySelectorAll('.line').forEach(line => {
            const row = parseInt(line.getAttribute('data-row'));
            const col = parseInt(line.getAttribute('data-col'));
            const type = line.getAttribute('data-type');
            const lineId = `${type}-${row}-${col}`;
            
            if (this.lines.has(lineId)) {
                const playerNum = this.drawnLines.get(lineId);
                line.classList.add('drawn', `player${playerNum}-line`);
            }
        });
        
        // Update boxes
        this.checkCompletedBoxes();
        this.updateUI();
    }

    showOnlineScreen() {
        // Hide all screens first
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('create-room-screen').classList.add('hidden');
        document.getElementById('join-room-screen').classList.add('hidden');
        document.getElementById('room-lobby-screen').classList.add('hidden');
        
        // Show online screen
        document.getElementById('online-screen').classList.remove('hidden');
    }

    showCreateRoomScreen() {
        document.getElementById('online-screen').classList.add('hidden');
        document.getElementById('create-room-screen').classList.remove('hidden');
        
        // Set up back button listener when screen is shown
        const backBtn = document.getElementById('create-room-back-btn');
        if (backBtn) {
            // Remove any existing listeners
            backBtn.replaceWith(backBtn.cloneNode(true));
            const newBackBtn = document.getElementById('create-room-back-btn');
            newBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showOnlineScreen();
            });
        }
        
        // Set up navigation buttons
        this.setupCreateRoomButtons();
    }

    showJoinRoomScreen() {
        document.getElementById('online-screen').classList.add('hidden');
        document.getElementById('join-room-screen').classList.remove('hidden');
        
        // Set up back button listener when screen is shown
        const backBtn = document.getElementById('join-room-back-btn');
        if (backBtn) {
            // Remove any existing listeners
            backBtn.replaceWith(backBtn.cloneNode(true));
            const newBackBtn = document.getElementById('join-room-back-btn');
            newBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showOnlineScreen();
            });
        }
        
        // Set up join room buttons
        this.setupJoinRoomButtons();
        
        // Pre-fill with most recent room code if available
        const recentRooms = this.getRecentRoomCodes();
        const roomCodeInput = document.getElementById('room-code-input');
        if (roomCodeInput && recentRooms.length > 0) {
            roomCodeInput.value = recentRooms[0];
            roomCodeInput.select(); // Select the text for easy replacement
        }
    }

    showRoomLobby() {
        console.log('Showing room lobby. isHost:', this.isHost, 'playerId:', this.playerId);
        document.getElementById('create-room-screen').classList.add('hidden');
        document.getElementById('join-room-screen').classList.add('hidden');
        document.getElementById('room-lobby-screen').classList.remove('hidden');
        
        // Set up back button listener when screen is shown
        const backBtn = document.getElementById('lobby-back-btn');
        if (backBtn) {
            // Remove any existing listeners
            backBtn.replaceWith(backBtn.cloneNode(true));
            const newBackBtn = document.getElementById('lobby-back-btn');
            newBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.leaveRoom();
                this.showOnlineScreen();
            });
        }
        
        // Set up room code button listener
        const roomCodeBtn = document.getElementById('room-code-btn');
        if (roomCodeBtn) {
            roomCodeBtn.replaceWith(roomCodeBtn.cloneNode(true));
            const newRoomCodeBtn = document.getElementById('room-code-btn');
            newRoomCodeBtn.addEventListener('click', () => {
                this.copyRoomCodeDirectly();
            });
        }
        
        // Set up manual start button listener
        const startButton = document.getElementById('start-game-manual-btn');
        if (startButton) {
            startButton.replaceWith(startButton.cloneNode(true));
            const newStartButton = document.getElementById('start-game-manual-btn');
            newStartButton.addEventListener('click', async () => {
                if (this.isHost) {
                    console.log('Manual start button clicked');
                    await this.startOnlineGame();
                }
            });
        }
        
        this.updateLobbyDisplay();
        
        // Start polling for room updates (faster polling for better responsiveness)
        this.lobbyInterval = setInterval(async () => {
            await this.updateLobbyDisplay();
        }, 500);
    }

    async updateLobbyDisplay() {
        const roomData = await this.getRoomData(this.roomCode);
        if (!roomData) {
            this.leaveRoom();
            this.returnToWelcome();
            return;
        }
        
        console.log('Updating lobby display. Players:', roomData.players.length, 'Required:', roomData.settings.playerCount, 'Game started:', roomData.gameStarted, 'Is host:', this.isHost);
        
        // Update room code display
        if (this.roomCode) {
            document.getElementById('room-code-text').textContent = this.roomCode;
            document.getElementById('room-code-large').textContent = this.roomCode;
        }
        
        // Update player info
        document.getElementById('lobby-player-info').textContent = 
            `${roomData.players.length}/${roomData.settings.playerCount}`;
        
        // Update grid info
        document.getElementById('lobby-grid-info').textContent = 
            `${roomData.settings.gridSize}×${roomData.settings.gridSize}`;
        
        // Update players list
        const playersContainer = document.getElementById('players-container');
        playersContainer.innerHTML = '';
        
        roomData.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            
            const colorIndicator = document.createElement('div');
            colorIndicator.className = 'player-color-indicator';
            colorIndicator.style.backgroundColor = this.playerColors[roomData.settings.playerCount][index];
            
            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = player.id === this.playerId ? 'You' : player.name;
            
            playerDiv.appendChild(colorIndicator);
            playerDiv.appendChild(playerName);
            
            if (player.isHost) {
                const hostBadge = document.createElement('span');
                hostBadge.className = 'player-host';
                hostBadge.textContent = 'HOST';
                playerDiv.appendChild(hostBadge);
            }
            
            playersContainer.appendChild(playerDiv);
        });
        
        // Update status
        const statusElement = document.getElementById('lobby-status');
        if (roomData.players.length === roomData.settings.playerCount) {
            if (roomData.gameStarted) {
                statusElement.textContent = 'Game in progress...';
                // If game already started and we're not in game, join it immediately
                if (!this.onlineGameStarted) {
                    console.log('Game detected as started, joining now...');
                    this.joinOngoingGame(roomData);
                }
            } else {
                statusElement.textContent = this.isHost ? 'Ready to start!' : 'Waiting for host to start...';
                
                // Show manual start button for host
                const startButton = document.getElementById('start-game-manual-btn');
                if (this.isHost) {
                    startButton.style.display = 'inline-flex';
                } else {
                    startButton.style.display = 'none';
                }
                
                // Auto-start if host and room is full (with shorter delay)
                if (this.isHost && !roomData.gameStarted && !this.startGameTimeout) {
                    console.log('Host detected, starting game in 1 second...');
                    this.startGameTimeout = setTimeout(async () => {
                        // Double-check room state before starting
                        const latestRoomData = await this.getRoomData(this.roomCode);
                        if (latestRoomData && !latestRoomData.gameStarted && 
                            latestRoomData.players.length === latestRoomData.settings.playerCount) {
                            console.log('Starting online game now!');
                            await this.startOnlineGame();
                        } else {
                            console.log('Game start cancelled - room state changed');
                        }
                        this.startGameTimeout = null;
                    }, 1000);
                }
            }
        } else {
            const needed = roomData.settings.playerCount - roomData.players.length;
            statusElement.textContent = `Waiting for ${needed} more player${needed > 1 ? 's' : ''}...`;
            
            // Hide start button when room is not full
            const startButton = document.getElementById('start-game-manual-btn');
            if (startButton) {
                startButton.style.display = 'none';
            }
            
            // Clear any pending start timeout if room is no longer full
            if (this.startGameTimeout) {
                clearTimeout(this.startGameTimeout);
                this.startGameTimeout = null;
            }
        }
        
        // Check for player changes and show notifications
        if (this.previousPlayerCount > 0 && roomData.players.length < this.previousPlayerCount) {
            this.showNotification('A player left the room');
        }
        
        this.previousPlayerCount = roomData.players.length;
        this.roomPlayers = roomData.players;
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Add to body
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    copyRoomCode() {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(this.roomCode).then(() => {
                const btn = document.getElementById('copy-room-code-btn');
                const originalText = btn.textContent;
                btn.textContent = 'Copied!';
                btn.classList.add('copied');
                
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.classList.remove('copied');
                }, 1500);
                
                // Close popup after copying
                setTimeout(() => {
                    document.getElementById('room-code-popup').classList.add('hidden');
                }, 1000);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.roomCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const btn = document.getElementById('copy-room-code-btn');
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.textContent = 'Copy';
                btn.classList.remove('copied');
                document.getElementById('room-code-popup').classList.add('hidden');
            }, 1500);
        }
    }

    copyRoomCodeDirectly() {
        if (!this.roomCode) return;
        
        // Provide immediate visual feedback
        this.showCopyFeedback();
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(this.roomCode).then(() => {
                this.showNotification(`Room code ${this.roomCode} copied!`);
            }).catch(() => {
                this.fallbackCopyRoomCode();
            });
        } else {
            this.fallbackCopyRoomCode();
        }
    }

    showCopyFeedback() {
        // Briefly change button text to show copy action
        const roomCodeBtn = document.getElementById('room-code-btn');
        const menuRoomCodeBtn = document.getElementById('menu-room-code-btn');
        const roomCodeText = document.getElementById('room-code-text');
        const menuRoomCodeText = document.getElementById('menu-room-code-text');
        
        const originalText = this.roomCode;
        
        if (roomCodeText) {
            roomCodeText.textContent = 'COPIED!';
            setTimeout(() => {
                roomCodeText.textContent = originalText;
            }, 1000);
        }
        
        if (menuRoomCodeText) {
            menuRoomCodeText.textContent = 'COPIED!';
            setTimeout(() => {
                menuRoomCodeText.textContent = originalText;
            }, 1000);
        }
    }

    fallbackCopyRoomCode() {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = this.roomCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showNotification(`Room code ${this.roomCode} copied!`);
        } catch (err) {
            this.showNotification(`Failed to copy. Room code: ${this.roomCode}`);
        }
        
        document.body.removeChild(textArea);
    }

    setupEventListeners() {
        // Welcome screen buttons
        const playComputerBtn = document.getElementById('play-computer-btn');
        if (playComputerBtn) {
            playComputerBtn.addEventListener('click', () => {
                this.showComputerScreen();
            });
        }

        const playFriendsBtn = document.getElementById('play-friends-btn');
        if (playFriendsBtn) {
            playFriendsBtn.addEventListener('click', () => {
                this.showStartScreen();
            });
        }

        const playOnlineBtn = document.getElementById('play-online-btn');
        if (playOnlineBtn) {
            playOnlineBtn.addEventListener('click', () => {
                this.showPremiumPopup();
            });
        }



        // Premium popup close button
        const premiumCloseBtn = document.getElementById('premium-close-btn');
        if (premiumCloseBtn) {
            premiumCloseBtn.addEventListener('click', () => {
                this.hidePremiumPopup();
            });
        }

        // Premium popup modal click outside to close
        const premiumPopup = document.getElementById('premium-popup');
        if (premiumPopup) {
            premiumPopup.addEventListener('click', (e) => {
                if (e.target.id === 'premium-popup') {
                    this.hidePremiumPopup();
                }
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            console.log('Settings button found, adding event listener');
            settingsBtn.addEventListener('click', (e) => {
                console.log('Settings button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.showSettings();
            });
        } else {
            console.error('Settings button not found');
        }

        // Settings modal events
        const closeSettings = document.getElementById('close-settings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                this.hideSettings();
            });
        }

        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target.id === 'settings-modal') {
                    this.hideSettings();
                }
            });
        }

        // Player name input
        const playerNameInput = document.getElementById('player-name-input');
        if (playerNameInput) {
            playerNameInput.addEventListener('input', (e) => {
                this.updatePlayerName(e.target.value);
            });
        }

        // Country selector
        const countryBtn = document.getElementById('country-btn');
        if (countryBtn) {
            countryBtn.addEventListener('click', () => {
                const dropdown = document.getElementById('country-dropdown');
                const isOpen = !dropdown.classList.contains('hidden');
                
                if (isOpen) {
                    dropdown.classList.add('hidden');
                    countryBtn.classList.remove('open');
                } else {
                    dropdown.classList.remove('hidden');
                    countryBtn.classList.add('open');
                }
            });
        }

        // Volume slider
        const volumeSlider = document.getElementById('volume-slider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.updateVolume(e.target.value);
            });
        }

        // Privacy button
        const privacyBtn = document.getElementById('privacy-btn');
        if (privacyBtn) {
            privacyBtn.addEventListener('click', () => {
                this.showPrivacy();
            });
        }

        // Privacy modal events
        const closePrivacy = document.getElementById('close-privacy');
        if (closePrivacy) {
            closePrivacy.addEventListener('click', () => {
                this.hidePrivacy();
            });
        }

        const privacyModal = document.getElementById('privacy-modal');
        if (privacyModal) {
            privacyModal.addEventListener('click', (e) => {
                if (e.target.id === 'privacy-modal') {
                    this.hidePrivacy();
                }
            });
        }

        // Back buttons
        document.getElementById('computer-back-btn').addEventListener('click', (e) => {
            e.target.blur(); // Remove focus to clear hover state
            this.returnToWelcome();
        });

        document.getElementById('friends-back-btn').addEventListener('click', (e) => {
            e.target.blur(); // Remove focus to clear hover state
            this.returnToWelcome();
        });

        // Online screen buttons
        const onlineBackBtn = document.getElementById('online-back-btn');
        if (onlineBackBtn) {
            onlineBackBtn.addEventListener('click', (e) => {
                console.log('Online back button clicked');
                e.target.blur();
                this.returnToWelcome();
            });
        } else {
            console.error('online-back-btn not found');
        }

        const createRoomBtn = document.getElementById('create-room-btn');
        if (createRoomBtn) {
            createRoomBtn.addEventListener('click', () => {
                this.showCreateRoomScreen();
            });
        } else {
            console.error('create-room-btn not found');
        }

        const joinRoomBtn = document.getElementById('join-room-btn');
        if (joinRoomBtn) {
            joinRoomBtn.addEventListener('click', () => {
                this.showJoinRoomScreen();
            });
        } else {
            console.error('join-room-btn not found');
        }

        // Create room screen - buttons are now set up dynamically when screen is shown

        // Join room screen - buttons are now set up dynamically when screen is shown

        // Room lobby screen
        const lobbyBackBtn = document.getElementById('lobby-back-btn');
        if (lobbyBackBtn) {
            lobbyBackBtn.addEventListener('click', (e) => {
                console.log('Lobby back button clicked');
                e.target.blur();
                this.leaveRoom();
                this.showOnlineScreen();
            });
        } else {
            console.error('lobby-back-btn not found');
        }

        // Room code button is now set up dynamically when lobby is shown

        // Room code popup
        const copyRoomCodeBtn = document.getElementById('copy-room-code-btn');
        if (copyRoomCodeBtn) {
            copyRoomCodeBtn.addEventListener('click', () => {
                this.copyRoomCode();
            });
        }

        const closeRoomCodePopup = document.getElementById('close-room-code-popup');
        if (closeRoomCodePopup) {
            closeRoomCodePopup.addEventListener('click', () => {
                document.getElementById('room-code-popup').classList.add('hidden');
            });
        }

        // Room code popup - close when clicking outside
        const roomCodePopup = document.getElementById('room-code-popup');
        if (roomCodePopup) {
            roomCodePopup.addEventListener('click', (e) => {
                if (e.target.id === 'room-code-popup') {
                    document.getElementById('room-code-popup').classList.add('hidden');
                }
            });
        }

        // Menu room code button
        const menuRoomCodeBtn = document.getElementById('menu-room-code-btn');
        if (menuRoomCodeBtn) {
            menuRoomCodeBtn.addEventListener('click', () => {
                this.copyRoomCodeDirectly();
            });
        }

        // Computer screen buttons
        document.getElementById('difficulty-prev').addEventListener('click', (e) => {
            e.target.blur();
            this.changeDifficulty(-1);
        });

        document.getElementById('difficulty-next').addEventListener('click', (e) => {
            e.target.blur();
            this.changeDifficulty(1);
        });

        document.getElementById('computer-grid-prev').addEventListener('click', (e) => {
            e.target.blur();
            this.changeComputerGridSize(-1);
        });

        document.getElementById('computer-grid-next').addEventListener('click', (e) => {
            e.target.blur();
            this.changeComputerGridSize(1);
        });

        const startComputerGameBtn = document.getElementById('start-computer-game-btn');
        if (startComputerGameBtn) {
            startComputerGameBtn.addEventListener('click', () => {
                this.startComputerGame();
            });
        }

        // Start screen buttons
        const startGameBtn = document.getElementById('start-game-btn');
        if (startGameBtn) {
            startGameBtn.addEventListener('click', () => {
                this.startGame();
            });
        }

        // Grid size navigation arrows
        document.getElementById('grid-prev').addEventListener('click', (e) => {
            e.target.blur();
            this.changeStartGridSize(-1);
        });

        document.getElementById('grid-next').addEventListener('click', (e) => {
            e.target.blur();
            this.changeStartGridSize(1);
        });

        // Player count navigation arrows
        document.getElementById('player-prev').addEventListener('click', (e) => {
            e.target.blur();
            this.changePlayerCount(-1);
        });

        document.getElementById('player-next').addEventListener('click', (e) => {
            e.target.blur();
            this.changePlayerCount(1);
        });

        // Menu buttons
        const menuBtn = document.getElementById('menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                this.showMenu();
            });
        }

        // Score button (no click functionality needed)

        // Menu options
        document.getElementById('resume-btn').addEventListener('click', () => {
            this.hideMenu();
        });

        const restartGameBtn = document.getElementById('restart-game-btn');
        if (restartGameBtn) {
            restartGameBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }

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
        const sizes = [5, 6, 7, 8];
        const currentIndex = sizes.indexOf(this.gridSize);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = sizes.length - 1;
        if (newIndex >= sizes.length) newIndex = 0;
        
        this.gridSize = sizes[newIndex];
        document.getElementById('grid-size-display').textContent = `${this.gridSize}×${this.gridSize}`;
        this.saveCachedSettings();
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
        this.saveCachedSettings();
    }

    changeRoomPlayerCount(direction) {
        const counts = [2, 3, 4, 5];
        const currentIndex = counts.indexOf(this.roomSettings.playerCount);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = counts.length - 1;
        if (newIndex >= counts.length) newIndex = 0;
        
        this.roomSettings.playerCount = counts[newIndex];
        document.getElementById('room-player-count-display').textContent = this.roomSettings.playerCount;
        this.saveCachedSettings();
    }

    changeRoomGridSize(direction) {
        const sizes = [5, 6, 7, 8];
        const currentIndex = sizes.indexOf(this.roomSettings.gridSize);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = sizes.length - 1;
        if (newIndex >= sizes.length) newIndex = 0;
        
        this.roomSettings.gridSize = sizes[newIndex];
        document.getElementById('room-grid-size-display').textContent = `${this.roomSettings.gridSize}×${this.roomSettings.gridSize}`;
        this.saveCachedSettings();
    }

    setupCreateRoomButtons() {
        // Player count buttons
        const playerPrev = document.getElementById('room-player-prev');
        const playerNext = document.getElementById('room-player-next');
        const gridPrev = document.getElementById('room-grid-prev');
        const gridNext = document.getElementById('room-grid-next');
        const createBtn = document.getElementById('create-room-final-btn');
        
        if (playerPrev) {
            playerPrev.replaceWith(playerPrev.cloneNode(true));
            document.getElementById('room-player-prev').addEventListener('click', (e) => {
                e.target.blur();
                this.changeRoomPlayerCount(-1);
            });
        }
        
        if (playerNext) {
            playerNext.replaceWith(playerNext.cloneNode(true));
            document.getElementById('room-player-next').addEventListener('click', (e) => {
                e.target.blur();
                this.changeRoomPlayerCount(1);
            });
        }
        
        if (gridPrev) {
            gridPrev.replaceWith(gridPrev.cloneNode(true));
            document.getElementById('room-grid-prev').addEventListener('click', (e) => {
                e.target.blur();
                this.changeRoomGridSize(-1);
            });
        }
        
        if (gridNext) {
            gridNext.replaceWith(gridNext.cloneNode(true));
            document.getElementById('room-grid-next').addEventListener('click', (e) => {
                e.target.blur();
                this.changeRoomGridSize(1);
            });
        }
        
        if (createBtn) {
            createBtn.replaceWith(createBtn.cloneNode(true));
            document.getElementById('create-room-final-btn').addEventListener('click', async () => {
                await this.createRoom();
            });
        }
    }

    setupJoinRoomButtons() {
        const roomCodeInput = document.getElementById('room-code-input');
        const joinBtn = document.getElementById('join-room-final-btn');
        
        if (roomCodeInput) {
            roomCodeInput.replaceWith(roomCodeInput.cloneNode(true));
            const newInput = document.getElementById('room-code-input');
            newInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const joinBtn = document.getElementById('join-room-final-btn');
                    if (joinBtn) joinBtn.click();
                }
            });
        }
        
        if (joinBtn) {
            joinBtn.replaceWith(joinBtn.cloneNode(true));
            document.getElementById('join-room-final-btn').addEventListener('click', async () => {
                const roomCodeInput = document.getElementById('room-code-input');
                if (roomCodeInput) {
                    const roomCode = roomCodeInput.value.trim();
                    if (roomCode.length === 4) {
                        await this.joinRoom(roomCode);
                    } else {
                        alert('Please enter a 4-letter room code');
                    }
                }
            });
        }
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
        const difficultyDisplay = document.getElementById('difficulty-display');
        difficultyDisplay.textContent = difficulties[newIndex];
        
        // Update difficulty color class
        this.updateDifficultyColor(difficultyDisplay);
        
        this.saveCachedSettings();
    }

    changeComputerGridSize(direction) {
        const sizes = [5, 6, 7, 8];
        const currentIndex = sizes.indexOf(this.gridSize);
        let newIndex = currentIndex + direction;
        
        // Wrap around
        if (newIndex < 0) newIndex = sizes.length - 1;
        if (newIndex >= sizes.length) newIndex = 0;
        
        this.gridSize = sizes[newIndex];
        document.getElementById('computer-grid-size-display').textContent = `${this.gridSize}×${this.gridSize}`;
        this.saveCachedSettings();
    }

    startComputerGame() {
        console.log('Starting computer game');
        // Set to 2 players and bot mode
        this.playerCount = 2;
        this.gameMode = 'bot';
        this.botThinking = false;
        
        console.log('Game mode set to:', this.gameMode, 'Current player:', this.currentPlayer);
        
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
        
        // If bot goes first (player 2), trigger bot move
        if (this.currentPlayer === 2) {
            console.log('Bot goes first, triggering move');
            setTimeout(() => this.botMove(), 500);
        }
    }

    // Bot AI Logic
    botMove() {
        console.log('Bot move called, current player:', this.currentPlayer, 'game mode:', this.gameMode);
        if (this.botThinking || this.gameOver || this.currentPlayer !== 2) return;
        
        this.botThinking = true;
        console.log('Bot is thinking...');
        
        // Add delay to make it feel more natural
        const delay = this.difficulty === 'easy' ? 800 : this.difficulty === 'medium' ? 600 : 400;
        
        setTimeout(() => {
            if (this.gameOver || this.currentPlayer !== 2) {
                this.botThinking = false;
                return;
            }
            
            const move = this.getBotMove();
            console.log('Bot selected move:', move);
            if (move) {
                // Mark as bot making move and call drawLine
                this.botMakingMove = true;
                this.drawLine(move);
                this.botMakingMove = false;
            }
            this.botThinking = false;
        }, delay);
    }

    getBotMove() {
        const availableLines = this.getAvailableLines();
        if (availableLines.length === 0) return null;

        switch (this.difficulty) {
            case 'easy':
                return this.getEasyMove(availableLines);
            case 'medium':
                return this.getMediumMove(availableLines);
            case 'hard':
                return this.getHardMove(availableLines);
            case 'expert':
                return this.getExpertMove(availableLines);
            default:
                return this.getEasyMove(availableLines);
        }
    }

    getAvailableLines() {
        return Array.from(document.querySelectorAll('.line:not(.drawn)'));
    }

    // Easy: "The Beginner" - Carefree, random, doesn't understand strategy
    getEasyMove(availableLines) {
        // 60% chance to complete a box if available (beginners like free points)
        if (Math.random() < 0.6) {
            const completingMove = this.findCompletingMove(availableLines);
            if (completingMove) return completingMove;
        }
        
        // 30% chance to avoid obviously bad moves
        if (Math.random() < 0.3) {
            const saferMoves = availableLines.filter(line => {
                const danger = this.calculateDanger(line);
                return danger < 10; // Avoid giving away multiple boxes
            });
            if (saferMoves.length > 0) {
                return saferMoves[Math.floor(Math.random() * saferMoves.length)];
            }
        }
        
        // Otherwise: random move
        return availableLines[Math.floor(Math.random() * availableLines.length)];
    }

    // Medium: "The Defender" - Cautious and reactive
    getMediumMove(availableLines) {
        // Always take free boxes
        const completingMove = this.findCompletingMove(availableLines);
        if (completingMove) return completingMove;
        
        // Find truly safe moves
        const safeMoves = this.findAllSafeMoves(availableLines);
        
        if (safeMoves.length > 0) {
            // Among safe moves, prefer those that don't create 2-line boxes
            const superSafeMoves = safeMoves.filter(line => {
                const adjacentBoxes = this.getAdjacentBoxes(line);
                return adjacentBoxes.every(box => this.countBoxLines(box) === 0);
            });
            
            if (superSafeMoves.length > 0) {
                return superSafeMoves[Math.floor(Math.random() * superSafeMoves.length)];
            }
            
            return safeMoves[Math.floor(Math.random() * safeMoves.length)];
        }
        
        // If no safe moves, pick the least dangerous
        return this.findLeastDangerousMove(availableLines);
    }

    // Hard: "The Strategist" - Tactical and calculating
    getHardMove(availableLines) {
        // Always take free boxes
        const completingMove = this.findCompletingMove(availableLines);
        if (completingMove) return completingMove;
        
        // Find safe moves first
        const safeMoves = this.findAllSafeMoves(availableLines);
        
        if (safeMoves.length > 0) {
            // Look for chain opportunities among safe moves
            const chainMove = this.findChainControlMove(safeMoves);
            if (chainMove) return chainMove;
            
            // Among safe moves, prefer strategic positions
            let bestMove = safeMoves[0];
            let bestScore = this.evaluatePositionValue(bestMove);
            
            for (const move of safeMoves) {
                const score = this.evaluatePositionValue(move);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
            return bestMove;
        }
        
        // If no safe moves, find least dangerous
        return this.findLeastDangerousMove(availableLines);
    }

    // Expert: "The Grandmaster" - Cold, precise, and manipulative
    getExpertMove(availableLines) {
        // Always take free boxes
        const completingMove = this.findCompletingMove(availableLines);
        if (completingMove) return completingMove;
        
        // Find safe moves first
        const safeMoves = this.findAllSafeMoves(availableLines);
        
        if (safeMoves.length > 0) {
            // Advanced chain analysis among safe moves
            const expertChainMove = this.findExpertChainMove(safeMoves);
            if (expertChainMove) return expertChainMove;
            
            // Use advanced evaluation for safe moves
            let bestMove = safeMoves[0];
            let bestScore = this.evaluateExpertMove(bestMove);
            
            for (const move of safeMoves) {
                const score = this.evaluateExpertMove(move);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = move;
                }
            }
            return bestMove;
        }
        
        // Only consider sacrifices if no safe moves exist
        const sacrificeMove = this.findExpertSacrifice(availableLines);
        if (sacrificeMove) return sacrificeMove;
        
        // If forced to make risky move, minimize damage
        return this.findLeastDangerousMove(availableLines);
    }

    findCompletingMove(availableLines) {
        // Find all moves that complete boxes
        const completingMoves = [];
        
        for (const line of availableLines) {
            if (this.wouldCompleteBox(line)) {
                const boxCount = this.countBoxesCompleted(line);
                completingMoves.push({ line, boxCount });
            }
        }
        
        if (completingMoves.length === 0) return null;
        
        // Sort by number of boxes completed (prefer more boxes)
        completingMoves.sort((a, b) => b.boxCount - a.boxCount);
        return completingMoves[0].line;
    }

    countBoxesCompleted(lineElement) {
        const adjacentBoxes = this.getAdjacentBoxes(lineElement);
        let count = 0;
        
        for (const box of adjacentBoxes) {
            const requiredLines = this.getBoxLines(box);
            const drawnLines = requiredLines.filter(id => this.lines.has(id));
            if (drawnLines.length === 3) { // This line would complete the box
                count++;
            }
        }
        
        return count;
    }

    findSafeMove(availableLines) {
        const safeMoves = availableLines.filter(line => {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            return adjacentBoxes.every(box => {
                const linesDrawn = this.countBoxLines(box);
                return linesDrawn <= 1; // Safe if box has 1 or fewer lines
            });
        });
        
        if (safeMoves.length > 0) {
            // Prefer moves that don't create any 2-line boxes
            const superSafeMoves = safeMoves.filter(line => {
                const adjacentBoxes = this.getAdjacentBoxes(line);
                return adjacentBoxes.every(box => {
                    const linesDrawn = this.countBoxLines(box);
                    return linesDrawn === 0; // Super safe if box has no lines
                });
            });
            
            if (superSafeMoves.length > 0) {
                return superSafeMoves[Math.floor(Math.random() * superSafeMoves.length)];
            }
            
            return safeMoves[Math.floor(Math.random() * safeMoves.length)];
        }
        return null;
    }

    // Simple chain detection for medium difficulty
    findSimpleChainMove(availableLines) {
        for (const line of availableLines) {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            
            // Look for boxes that would have 2 lines after this move
            for (const box of adjacentBoxes) {
                const linesDrawn = this.countBoxLines(box);
                if (linesDrawn === 1) {
                    // Check if this creates a potential chain
                    const neighbors = this.getNeighborBoxes(box);
                    const chainPotential = neighbors.filter(neighbor => {
                        const neighborLines = this.countBoxLines(neighbor);
                        return neighborLines >= 1;
                    }).length;
                    
                    if (chainPotential >= 2) {
                        return line; // This could start a good chain
                    }
                }
            }
        }
        return null;
    }

    // Get neighboring boxes for chain analysis
    getNeighborBoxes(box) {
        const neighbors = [];
        const directions = [
            { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
            { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
        ];
        
        for (const { dr, dc } of directions) {
            const newRow = box.row + dr;
            const newCol = box.col + dc;
            
            if (newRow >= 0 && newRow < this.gridSize - 1 && 
                newCol >= 0 && newCol < this.gridSize - 1) {
                const neighbor = this.boxes.find(b => b.row === newRow && b.col === newCol);
                if (neighbor && neighbor.owner === null) {
                    neighbors.push(neighbor);
                }
            }
        }
        
        return neighbors;
    }

    findLeastDangerousMove(availableLines) {
        let leastDangerousMoves = [];
        let minDanger = Infinity;
        
        for (const line of availableLines) {
            const danger = this.calculateDanger(line);
            if (danger < minDanger) {
                minDanger = danger;
                leastDangerousMoves = [line];
            } else if (danger === minDanger) {
                leastDangerousMoves.push(line);
            }
        }
        
        // Add some randomization to prevent predictable patterns
        return leastDangerousMoves[Math.floor(Math.random() * leastDangerousMoves.length)];
    }

    findChainMove(availableLines) {
        // Look for moves that set up chains
        for (const line of availableLines) {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            for (const box of adjacentBoxes) {
                const linesDrawn = this.countBoxLines(box);
                if (linesDrawn === 2) {
                    // This could start a chain
                    return line;
                }
            }
        }
        return null;
    }

    findBestStrategicMove(availableLines) {
        // Prefer moves in the center of the board
        const centerMoves = availableLines.filter(line => {
            const row = parseInt(line.getAttribute('data-row'));
            const col = parseInt(line.getAttribute('data-col'));
            const center = Math.floor(this.gridSize / 2);
            return Math.abs(row - center) <= 1 && Math.abs(col - center) <= 1;
        });
        
        if (centerMoves.length > 0) {
            return centerMoves[Math.floor(Math.random() * centerMoves.length)];
        }
        
        return this.findSafeMove(availableLines) || availableLines[0];
    }

    wouldCompleteBox(lineElement) {
        const row = parseInt(lineElement.getAttribute('data-row'));
        const col = parseInt(lineElement.getAttribute('data-col'));
        const type = lineElement.getAttribute('data-type');
        const lineId = `${type}-${row}-${col}`;
        
        const adjacentBoxes = this.getAdjacentBoxes(lineElement);
        
        for (const box of adjacentBoxes) {
            const requiredLines = this.getBoxLines(box);
            const drawnLines = requiredLines.filter(id => this.lines.has(id) || id === lineId);
            if (drawnLines.length === 4) {
                return true;
            }
        }
        
        return false;
    }

    getAdjacentBoxes(lineElement) {
        const row = parseInt(lineElement.getAttribute('data-row'));
        const col = parseInt(lineElement.getAttribute('data-col'));
        const type = lineElement.getAttribute('data-type');
        
        const boxes = [];
        
        if (type === 'horizontal') {
            // Box above
            if (row > 0) {
                const box = this.boxes.find(b => b.row === row - 1 && b.col === col);
                if (box) boxes.push(box);
            }
            // Box below
            if (row < this.gridSize - 1) {
                const box = this.boxes.find(b => b.row === row && b.col === col);
                if (box) boxes.push(box);
            }
        } else {
            // Box left
            if (col > 0) {
                const box = this.boxes.find(b => b.row === row && b.col === col - 1);
                if (box) boxes.push(box);
            }
            // Box right
            if (col < this.gridSize - 1) {
                const box = this.boxes.find(b => b.row === row && b.col === col);
                if (box) boxes.push(box);
            }
        }
        
        return boxes;
    }

    getBoxLines(box) {
        const { row, col } = box;
        return [
            `horizontal-${row}-${col}`,
            `horizontal-${row + 1}-${col}`,
            `vertical-${row}-${col}`,
            `vertical-${row}-${col + 1}`
        ];
    }

    countBoxLines(box) {
        const requiredLines = this.getBoxLines(box);
        return requiredLines.filter(id => this.lines.has(id)).length;
    }

    countAdjacentBoxes(lineElement) {
        const adjacentBoxes = this.getAdjacentBoxes(lineElement);
        return adjacentBoxes.map(box => this.countBoxLines(box));
    }

    calculateDanger(lineElement) {
        const adjacentBoxes = this.getAdjacentBoxes(lineElement);
        let danger = 0;
        
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            if (linesDrawn === 2) {
                // This move would complete a box for the opponent
                danger += 10;
            } else if (linesDrawn === 1) {
                // This move creates a 2-line box (risky but not immediately dangerous)
                danger += 1;
            }
        }
        
        return danger;
    }

    // Safety check: never give away free boxes unless forced
    isSafeMove(lineElement) {
        const adjacentBoxes = this.getAdjacentBoxes(lineElement);
        return adjacentBoxes.every(box => {
            const linesDrawn = this.countBoxLines(box);
            return linesDrawn <= 1; // Safe if box has 1 or fewer lines
        });
    }

    // Find all truly safe moves
    findAllSafeMoves(availableLines) {
        return availableLines.filter(line => this.isSafeMove(line));
    }

    // Advanced Strategy: Chain Control
    findChainControlMove(availableLines) {
        const chains = this.identifyChains();
        
        // Prefer to control long chains
        for (const chain of chains.sort((a, b) => b.length - a.length)) {
            if (chain.length >= 3) {
                // Look for moves that give us control of this chain
                const controlMove = this.findChainControllingMove(chain, availableLines);
                if (controlMove) return controlMove;
            }
        }
        
        return null;
    }

    // Advanced Strategy: Sacrifice smaller chains to control larger ones
    findSacrificeMove(availableLines) {
        const chains = this.identifyChains();
        const longChains = chains.filter(c => c.length >= 4);
        const shortChains = chains.filter(c => c.length === 2);
        
        // If there are long chains available, sacrifice short ones
        if (longChains.length > 0 && shortChains.length > 0) {
            // Give opponent a short chain to maintain control
            for (const shortChain of shortChains) {
                const sacrificeMove = this.findChainStartingMove(shortChain, availableLines);
                if (sacrificeMove) return sacrificeMove;
            }
        }
        
        return null;
    }

    // Advanced Strategy: Parity-based optimal moves
    findParityOptimalMove(availableLines) {
        const totalBoxes = (this.gridSize - 1) * (this.gridSize - 1);
        const completedBoxes = this.boxes.filter(b => b.owner !== null).length;
        const remainingBoxes = totalBoxes - completedBoxes;
        
        // In endgame, parity matters
        if (remainingBoxes <= 8) {
            const chains = this.identifyChains();
            const chainCount = chains.length;
            
            // Try to maintain favorable parity
            if (chainCount % 2 === 0) {
                // Even number of chains - try to keep it even
                return this.findParityPreservingMove(availableLines);
            } else {
                // Odd number of chains - try to make it even
                return this.findParityChangingMove(availableLines);
            }
        }
        
        return null;
    }

    // Master Strategy: Chain manipulation for experts
    findChainMasterMove(availableLines) {
        const chains = this.identifyChains();
        
        // Advanced chain analysis
        for (const chain of chains) {
            if (chain.length >= 2) {
                // Check if we can create a double-dealing situation
                const doubleMove = this.findDoubleDealMove(chain, availableLines);
                if (doubleMove) return doubleMove;
                
                // Check for chain merging opportunities
                const mergeMove = this.findChainMergeMove(chain, chains, availableLines);
                if (mergeMove) return mergeMove;
            }
        }
        
        return null;
    }

    // Master Strategy: Endgame optimization
    findEndgameOptimalMove(availableLines) {
        const totalBoxes = (this.gridSize - 1) * (this.gridSize - 1);
        const completedBoxes = this.boxes.filter(b => b.owner !== null).length;
        const remainingBoxes = totalBoxes - completedBoxes;
        
        if (remainingBoxes <= 6) {
            // Use perfect endgame play
            return this.findPerfectEndgameMove(availableLines);
        }
        
        return null;
    }

    // Master Strategy: Minimax with alpha-beta pruning
    findMinimaxMove(availableLines, depth) {
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of availableLines.slice(0, Math.min(8, availableLines.length))) {
            const score = this.minimax(move, depth - 1, -Infinity, Infinity, false);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    // Master Strategy: Tempo control
    findTempoControlMove(availableLines) {
        // Look for moves that force opponent into bad positions
        for (const move of availableLines) {
            if (this.createsForcedSequence(move)) {
                return move;
            }
        }
        
        return null;
    }

    // Helper: Identify all chains on the board
    identifyChains() {
        const chains = [];
        const visited = new Set();
        
        for (const box of this.boxes) {
            if (box.owner === null && !visited.has(`${box.row}-${box.col}`)) {
                const chain = this.exploreChain(box, visited);
                if (chain.length >= 2) {
                    chains.push(chain);
                }
            }
        }
        
        return chains;
    }

    // Helper: Explore a chain starting from a box
    exploreChain(startBox, visited) {
        const chain = [];
        const queue = [startBox];
        
        while (queue.length > 0) {
            const box = queue.shift();
            const key = `${box.row}-${box.col}`;
            
            if (visited.has(key) || box.owner !== null) continue;
            
            const linesDrawn = this.countBoxLines(box);
            if (linesDrawn < 2) continue;
            
            visited.add(key);
            chain.push(box);
            
            // Add adjacent boxes that could be part of the chain
            const adjacent = this.getAdjacentChainBoxes(box);
            queue.push(...adjacent);
        }
        
        return chain;
    }

    // Helper: Get adjacent boxes that could be part of a chain
    getAdjacentChainBoxes(box) {
        const adjacent = [];
        const directions = [
            { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
            { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
        ];
        
        for (const { dr, dc } of directions) {
            const newRow = box.row + dr;
            const newCol = box.col + dc;
            
            if (newRow >= 0 && newRow < this.gridSize - 1 && 
                newCol >= 0 && newCol < this.gridSize - 1) {
                const adjBox = this.boxes.find(b => b.row === newRow && b.col === newCol);
                if (adjBox && adjBox.owner === null) {
                    adjacent.push(adjBox);
                }
            }
        }
        
        return adjacent;
    }

    // Helper: Minimax algorithm with alpha-beta pruning
    minimax(move, depth, alpha, beta, isMaximizing) {
        if (depth === 0) {
            return this.evaluatePosition();
        }
        
        // Simulate the move
        const simulation = this.simulateMove(move);
        
        if (isMaximizing) {
            let maxEval = -Infinity;
            const nextMoves = this.getAvailableLines();
            
            for (const nextMove of nextMoves.slice(0, 5)) {
                const evaluation = this.minimax(nextMove, depth - 1, alpha, beta, false);
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            
            this.undoSimulation(simulation);
            return maxEval;
        } else {
            let minEval = Infinity;
            const nextMoves = this.getAvailableLines();
            
            for (const nextMove of nextMoves.slice(0, 5)) {
                const evaluation = this.minimax(nextMove, depth - 1, alpha, beta, true);
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            
            this.undoSimulation(simulation);
            return minEval;
        }
    }

    // Helper: Evaluate current position
    evaluatePosition() {
        const myScore = this.scores.player2 || 0;
        const opponentScore = this.scores.player1 || 0;
        const scoreDiff = myScore - opponentScore;
        
        // Add positional factors
        const chains = this.identifyChains();
        const longChains = chains.filter(c => c.length >= 3).length;
        const shortChains = chains.filter(c => c.length === 2).length;
        
        return scoreDiff * 10 + longChains * 5 - shortChains * 2;
    }

    // Helper: Simulate a move
    simulateMove(move) {
        // Return state to restore later
        return {
            lines: new Set(this.lines),
            scores: { ...this.scores },
            currentPlayer: this.currentPlayer
        };
    }

    // Helper: Undo simulation
    undoSimulation(state) {
        this.lines = state.lines;
        this.scores = state.scores;
        this.currentPlayer = state.currentPlayer;
    }

    // Improved Helper Methods
    findChainControlMove(availableLines) {
        // Look for moves that help control chains
        for (const line of availableLines) {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            let chainPotential = 0;
            
            for (const box of adjacentBoxes) {
                const linesDrawn = this.countBoxLines(box);
                if (linesDrawn === 1) {
                    // Check if this connects to other boxes with lines
                    const neighbors = this.getNeighborBoxes(box);
                    const connectedBoxes = neighbors.filter(n => this.countBoxLines(n) >= 1);
                    chainPotential += connectedBoxes.length;
                }
            }
            
            if (chainPotential >= 2) {
                const danger = this.calculateDanger(line);
                if (danger === 0) { // Only if safe
                    return line;
                }
            }
        }
        return null;
    }

    evaluatePositionValue(line) {
        const row = parseInt(line.getAttribute('data-row'));
        const col = parseInt(line.getAttribute('data-col'));
        const center = Math.floor(this.gridSize / 2);
        
        // Prefer central positions
        const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
        let score = Math.max(0, 4 - distanceFromCenter);
        
        // Add strategic value based on adjacent boxes
        const adjacentBoxes = this.getAdjacentBoxes(line);
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            if (linesDrawn === 0) {
                score += 1; // Good to start new areas
            } else if (linesDrawn === 1) {
                score += 0.5; // Decent to build on existing
            }
        }
        
        return score;
    }

    // Expert Bot Helper Methods
    findExpertChainMove(availableLines) {
        // Advanced chain analysis for expert bot
        const chains = this.identifyChains();
        
        for (const line of availableLines) {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            
            for (const box of adjacentBoxes) {
                const linesDrawn = this.countBoxLines(box);
                
                // Look for chain control opportunities
                if (linesDrawn === 1) {
                    const neighbors = this.getNeighborBoxes(box);
                    const chainNeighbors = neighbors.filter(n => this.countBoxLines(n) >= 2);
                    
                    if (chainNeighbors.length >= 2) {
                        // This could control a chain junction
                        return line;
                    }
                }
            }
        }
        
        return null;
    }

    findExpertSacrifice(availableLines) {
        // Look for tactical sacrifices that give long-term advantage
        for (const line of availableLines) {
            const immediateRisk = this.calculateDanger(line);
            
            if (immediateRisk >= 1 && immediateRisk <= 2) {
                // Small sacrifice - check if it prevents bigger loss
                const futureGain = this.estimateFutureGain(line);
                
                if (futureGain > immediateRisk + 1) {
                    return line; // Net positive sacrifice
                }
            }
        }
        
        return null;
    }

    evaluateExpertMove(line) {
        let score = 0;
        
        // Position value
        score += this.evaluatePositionValue(line);
        
        // Chain potential
        const adjacentBoxes = this.getAdjacentBoxes(line);
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            const neighbors = this.getNeighborBoxes(box);
            
            if (linesDrawn === 1) {
                const connectedBoxes = neighbors.filter(n => this.countBoxLines(n) >= 1);
                score += connectedBoxes.length * 0.5;
            }
        }
        
        // Future control potential
        score += this.estimateFutureGain(line) * 0.3;
        
        return score;
    }

    estimateFutureGain(line) {
        const adjacentBoxes = this.getAdjacentBoxes(line);
        let gain = 0;
        
        for (const box of adjacentBoxes) {
            const neighbors = this.getNeighborBoxes(box);
            const potentialChain = neighbors.filter(n => {
                const lines = this.countBoxLines(n);
                return lines >= 1 && lines <= 2;
            });
            
            gain += potentialChain.length * 0.5;
        }
        
        return gain;
    }

    identifyChains() {
        const chains = [];
        const visited = new Set();
        
        for (const box of this.boxes) {
            if (box.owner === null && !visited.has(`${box.row}-${box.col}`)) {
                const linesDrawn = this.countBoxLines(box);
                if (linesDrawn >= 2) {
                    const chain = this.exploreChain(box, visited);
                    if (chain.length >= 2) {
                        chains.push(chain);
                    }
                }
            }
        }
        
        return chains;
    }

    // Hard Bot Helper Methods
    findStrategicMove(availableLines) {
        // Look 2-3 moves ahead to evaluate consequences
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of availableLines.slice(0, Math.min(8, availableLines.length))) {
            const score = this.evaluateMoveStrategically(move, 2);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    evaluateMoveStrategically(move, depth) {
        if (depth === 0) return 0;
        
        // Simulate the move
        const originalState = this.captureGameState();
        const boxesGained = this.simulateMoveExecution(move);
        
        let score = boxesGained * 10; // Base score for immediate boxes
        
        // Evaluate chain implications
        const chainAnalysis = this.analyzeChainImpact(move);
        score += chainAnalysis.chainValue;
        
        // Look ahead to opponent's response
        if (depth > 1) {
            const opponentMoves = this.getAvailableLines();
            let worstOpponentScore = -Infinity;
            
            for (const opponentMove of opponentMoves.slice(0, 5)) {
                const opponentScore = this.evaluateMoveStrategically(opponentMove, depth - 1);
                worstOpponentScore = Math.max(worstOpponentScore, opponentScore);
            }
            
            score -= worstOpponentScore * 0.7; // Discount opponent's potential
        }
        
        this.restoreGameState(originalState);
        return score;
    }

    findTacticalSacrificeMove(availableLines) {
        // Look for moves that sacrifice 1-2 boxes to prevent opponent from getting more
        for (const move of availableLines) {
            const sacrifice = this.calculateImmediateRisk(move);
            if (sacrifice >= 1 && sacrifice <= 2) {
                const futureGain = this.calculateFutureGain(move);
                if (futureGain > sacrifice + 2) { // Net positive after sacrifice
                    return move;
                }
            }
        }
        return null;
    }

    findChainSetupMove(availableLines) {
        // Build potential chains for endgame advantage
        for (const move of availableLines) {
            const chainPotential = this.evaluateChainPotential(move);
            if (chainPotential >= 3) { // Good chain setup potential
                const risk = this.calculateImmediateRisk(move);
                if (risk === 0) { // Only if safe
                    return move;
                }
            }
        }
        return null;
    }

    findSafeStrategicMove(availableLines) {
        // Safe moves that also have strategic value
        const safeMoves = availableLines.filter(move => this.calculateImmediateRisk(move) === 0);
        
        if (safeMoves.length === 0) return null;
        
        let bestMove = safeMoves[0];
        let bestValue = 0;
        
        for (const move of safeMoves) {
            const strategicValue = this.evaluateStrategicValue(move);
            if (strategicValue > bestValue) {
                bestValue = strategicValue;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    // Expert Bot Helper Methods
    evaluateDoubleCross(completingMove, availableLines) {
        // Implement double-cross: take all but 2 boxes from a chain
        const chainInfo = this.analyzeChainFromMove(completingMove);
        
        if (chainInfo && chainInfo.length >= 4) {
            // This is a long chain - consider double-cross
            const doubleCrossMove = this.findDoubleCrossMove(chainInfo, availableLines);
            if (doubleCrossMove) {
                const netAdvantage = this.calculateDoubleCrossAdvantage(chainInfo);
                if (netAdvantage > 0) {
                    return doubleCrossMove;
                }
            }
        }
        
        return null;
    }

    findChainControlMove(availableLines) {
        // Analyze all chains and determine optimal control strategy
        const allChains = this.identifyAllChains();
        const chainParity = this.calculateChainParity(allChains);
        
        // Find move that gives us optimal chain control
        for (const move of availableLines) {
            const controlValue = this.evaluateChainControl(move, allChains, chainParity);
            if (controlValue >= 5) { // High control value threshold
                return move;
            }
        }
        
        return null;
    }

    findDeliberateSacrifice(availableLines) {
        // Sacrifice boxes strategically to manipulate final parity
        for (const move of availableLines) {
            const sacrifice = this.calculateImmediateRisk(move);
            if (sacrifice >= 1) {
                const parityAdvantage = this.calculateParityAdvantage(move);
                const futureGain = this.calculateLongTermGain(move);
                
                if (futureGain - sacrifice >= 3) { // Net gain of 3+ boxes
                    return move;
                }
            }
        }
        
        return null;
    }

    findOptimalEndgameMove(availableLines) {
        // Perfect endgame play using mathematical analysis
        const totalBoxes = (this.gridSize - 1) * (this.gridSize - 1);
        const completedBoxes = this.boxes.filter(b => b.owner !== null).length;
        const remainingBoxes = totalBoxes - completedBoxes;
        
        if (remainingBoxes <= 10) { // Endgame threshold
            return this.calculateOptimalEndgameMove(availableLines);
        }
        
        return null;
    }

    findForcingMove(availableLines) {
        // Find moves that force opponent into disadvantageous positions
        for (const move of availableLines) {
            const forcingValue = this.evaluateForcingPower(move);
            if (forcingValue >= 4) { // High forcing value
                return move;
            }
        }
        
        return null;
    }

    findPatternBasedMove(availableLines) {
        // Use pattern recognition for known advantageous configurations
        const patterns = this.recognizePatterns();
        
        for (const pattern of patterns) {
            const patternMove = this.findMoveForPattern(pattern, availableLines);
            if (patternMove) {
                return patternMove;
            }
        }
        
        return null;
    }

    findOptimalSafeMove(availableLines) {
        // Mathematically optimal safe move with maximum strategic value
        const safeMoves = availableLines.filter(move => this.calculateImmediateRisk(move) === 0);
        
        if (safeMoves.length === 0) return null;
        
        let bestMove = safeMoves[0];
        let bestScore = -Infinity;
        
        for (const move of safeMoves) {
            const score = this.calculateOptimalScore(move);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    // Supporting Analysis Methods
    analyzeChainImpact(move) {
        const adjacentBoxes = this.getAdjacentBoxes(move);
        let chainValue = 0;
        
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            const neighbors = this.getNeighborBoxes(box);
            
            // Evaluate chain potential
            if (linesDrawn === 1) {
                const connectedBoxes = neighbors.filter(n => this.countBoxLines(n) >= 1);
                chainValue += connectedBoxes.length * 0.5;
            } else if (linesDrawn === 2) {
                chainValue -= 2; // Creates opportunity for opponent
            }
        }
        
        return { chainValue };
    }

    calculateFutureGain(move) {
        // Estimate future boxes gained from this move
        const adjacentBoxes = this.getAdjacentBoxes(move);
        let futureGain = 0;
        
        for (const box of adjacentBoxes) {
            const neighbors = this.getNeighborBoxes(box);
            const chainPotential = neighbors.filter(n => {
                const lines = this.countBoxLines(n);
                return lines >= 1 && lines <= 2;
            }).length;
            
            futureGain += chainPotential * 0.7;
        }
        
        return futureGain;
    }

    evaluateChainPotential(move) {
        const adjacentBoxes = this.getAdjacentBoxes(move);
        let potential = 0;
        
        for (const box of adjacentBoxes) {
            const neighbors = this.getNeighborBoxes(box);
            for (const neighbor of neighbors) {
                const lines = this.countBoxLines(neighbor);
                if (lines >= 1) {
                    potential += 1;
                }
            }
        }
        
        return potential;
    }

    evaluateStrategicValue(move) {
        let value = 0;
        
        // Position value (center is better)
        const row = parseInt(move.getAttribute('data-row'));
        const col = parseInt(move.getAttribute('data-col'));
        const center = Math.floor(this.gridSize / 2);
        const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
        value += Math.max(0, 3 - distanceFromCenter);
        
        // Chain building value
        const chainPotential = this.evaluateChainPotential(move);
        value += chainPotential * 0.5;
        
        return value;
    }

    identifyAllChains() {
        const chains = [];
        const visited = new Set();
        
        for (const box of this.boxes) {
            if (box.owner === null && !visited.has(`${box.row}-${box.col}`)) {
                const chain = this.exploreChainFromBox(box, visited);
                if (chain.length >= 2) {
                    chains.push(chain);
                }
            }
        }
        
        return chains;
    }

    exploreChainFromBox(startBox, visited) {
        const chain = [];
        const queue = [startBox];
        
        while (queue.length > 0) {
            const box = queue.shift();
            const key = `${box.row}-${box.col}`;
            
            if (visited.has(key) || box.owner !== null) continue;
            
            const linesDrawn = this.countBoxLines(box);
            if (linesDrawn < 2) continue;
            
            visited.add(key);
            chain.push(box);
            
            // Add connected boxes
            const neighbors = this.getNeighborBoxes(box);
            for (const neighbor of neighbors) {
                if (!visited.has(`${neighbor.row}-${neighbor.col}`) && this.countBoxLines(neighbor) >= 2) {
                    queue.push(neighbor);
                }
            }
        }
        
        return chain;
    }

    identifyPotentialChains() {
        // More sophisticated chain detection
        const chains = [];
        const visited = new Set();
        
        for (const box of this.boxes) {
            if (box.owner === null && !visited.has(`${box.row}-${box.col}`)) {
                const linesDrawn = this.countBoxLines(box);
                if (linesDrawn >= 1) { // Include boxes with 1+ lines
                    const chain = this.exploreChainAdvanced(box, visited);
                    if (chain.length >= 2) {
                        chains.push(chain);
                    }
                }
            }
        }
        
        return chains;
    }

    exploreChainAdvanced(startBox, visited) {
        const chain = [];
        const queue = [startBox];
        
        while (queue.length > 0) {
            const box = queue.shift();
            const key = `${box.row}-${box.col}`;
            
            if (visited.has(key) || box.owner !== null) continue;
            
            const linesDrawn = this.countBoxLines(box);
            if (linesDrawn === 0) continue; // Skip empty boxes
            
            visited.add(key);
            chain.push(box);
            
            // Add connected boxes
            const connected = this.getConnectedChainBoxes(box);
            queue.push(...connected.filter(b => !visited.has(`${b.row}-${b.col}`)));
        }
        
        return chain;
    }

    getConnectedChainBoxes(box) {
        const connected = [];
        const neighbors = this.getNeighborBoxes(box);
        
        for (const neighbor of neighbors) {
            const neighborLines = this.countBoxLines(neighbor);
            if (neighborLines >= 1) {
                // Check if they share a drawn line (are actually connected)
                if (this.boxesShareDrawnLine(box, neighbor)) {
                    connected.push(neighbor);
                }
            }
        }
        
        return connected;
    }

    boxesShareDrawnLine(box1, box2) {
        const box1Lines = this.getBoxLines(box1);
        const box2Lines = this.getBoxLines(box2);
        
        for (const line1 of box1Lines) {
            for (const line2 of box2Lines) {
                if (line1 === line2 && this.lines.has(line1)) {
                    return true;
                }
            }
        }
        return false;
    }

    findPositionalMove(availableLines) {
        // Control key positions on the board
        const center = Math.floor(this.gridSize / 2);
        const keyPositions = [];
        
        for (const line of availableLines) {
            const row = parseInt(line.getAttribute('data-row'));
            const col = parseInt(line.getAttribute('data-col'));
            
            // Score based on position
            let score = 0;
            
            // Center control
            const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
            score += Math.max(0, 5 - distanceFromCenter);
            
            // Edge control (sometimes valuable)
            if (row === 0 || row === this.gridSize - 1 || col === 0 || col === this.gridSize - 1) {
                score += 2;
            }
            
            // Corner control
            if ((row === 0 || row === this.gridSize - 1) && (col === 0 || col === this.gridSize - 1)) {
                score += 3;
            }
            
            const danger = this.calculateDanger(line);
            if (danger < 5) { // Only consider if not too dangerous
                keyPositions.push({ line, score });
            }
        }
        
        if (keyPositions.length > 0) {
            keyPositions.sort((a, b) => b.score - a.score);
            return keyPositions[0].line;
        }
        
        return null;
    }

    findChainBlockingMove(availableLines) {
        // Block opponent's potential chains
        for (const line of availableLines) {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            
            for (const box of adjacentBoxes) {
                const linesDrawn = this.countBoxLines(box);
                if (linesDrawn === 1) {
                    // Check if this box could become part of a dangerous chain
                    const chainPotential = this.assessChainPotential(box);
                    if (chainPotential >= 3) {
                        return line; // Block this potential chain
                    }
                }
            }
        }
        
        return null;
    }

    assessChainPotential(box) {
        let potential = 0;
        const neighbors = this.getNeighborBoxes(box);
        
        for (const neighbor of neighbors) {
            const neighborLines = this.countBoxLines(neighbor);
            if (neighborLines >= 1) {
                potential += neighborLines;
            }
        }
        
        return potential;
    }

    findStrategicSafeMove(availableLines) {
        // Safe moves that also have strategic value
        const safeMoves = availableLines.filter(line => {
            const danger = this.calculateDanger(line);
            return danger === 0;
        });
        
        if (safeMoves.length === 0) return null;
        
        // Among safe moves, find those with highest strategic value
        const scoredMoves = [];
        
        for (const move of safeMoves) {
            let score = 0;
            
            // Prefer moves that create future opportunities
            const adjacentBoxes = this.getAdjacentBoxes(move);
            for (const box of adjacentBoxes) {
                const linesDrawn = this.countBoxLines(box);
                if (linesDrawn === 0) {
                    score += 2; // Good to start new areas
                } else if (linesDrawn === 1) {
                    score += 1; // Decent to build on existing
                }
            }
            
            // Prefer central moves
            const row = parseInt(move.getAttribute('data-row'));
            const col = parseInt(move.getAttribute('data-col'));
            const center = Math.floor(this.gridSize / 2);
            const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
            score += Math.max(0, 3 - distanceFromCenter);
            
            // Add small random factor to prevent identical play
            score += Math.random() * 0.5;
            
            scoredMoves.push({ move, score });
        }
        
        // Sort by score and pick from top moves
        scoredMoves.sort((a, b) => b.score - a.score);
        
        // Pick from top 3 moves to add variety
        const topMoves = scoredMoves.slice(0, Math.min(3, scoredMoves.length));
        const selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];
        
        return selectedMove.move;
    }

    // Placeholder implementations for advanced strategies
    findChainControllingMove(chain, availableLines) {
        // Find move that gives control of the chain
        return availableLines.find(line => {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            return adjacentBoxes.some(box => chain.includes(box));
        });
    }

    findChainStartingMove(chain, availableLines) {
        // Find move that starts the chain for opponent
        return availableLines.find(line => {
            const adjacentBoxes = this.getAdjacentBoxes(line);
            return adjacentBoxes.some(box => {
                const linesDrawn = this.countBoxLines(box);
                return linesDrawn === 2 && chain.includes(box);
            });
        });
    }

    findParityPreservingMove(availableLines) {
        return this.findSafeMove(availableLines);
    }

    findParityChangingMove(availableLines) {
        return availableLines.find(line => {
            const danger = this.calculateDanger(line);
            return danger === 1; // Slightly risky but changes parity
        });
    }

    findDoubleDealMove(chain, availableLines) {
        // Advanced tactic - placeholder
        return null;
    }

    findChainMergeMove(chain, allChains, availableLines) {
        // Advanced tactic - placeholder
        return null;
    }

    findPerfectEndgameMove(availableLines) {
        // Perfect endgame play - use minimax
        return this.findMinimaxMove(availableLines, 6);
    }

    createsForcedSequence(move) {
        // Check if move creates a forced sequence
        const adjacentBoxes = this.getAdjacentBoxes(move);
        return adjacentBoxes.some(box => {
            const linesDrawn = this.countBoxLines(box);
            return linesDrawn === 2; // Creates a forced move for opponent
        });
    }

    // Expert-level AI functions
    findDeepAnalysisMove(availableLines) {
        // Analyze moves 2-3 steps ahead
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of availableLines.slice(0, Math.min(10, availableLines.length))) {
            const score = this.analyzeMoveLookahead(move, 2);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    analyzeMoveLookahead(move, depth) {
        if (depth === 0) return this.evaluatePosition();
        
        // Simulate this move
        const originalState = this.captureGameState();
        const boxesCompleted = this.simulateMoveExecution(move);
        
        let score = boxesCompleted * 10; // Base score for boxes gained
        
        if (depth > 1) {
            // Analyze opponent's best response
            const opponentMoves = this.getAvailableLines();
            let worstOpponentScore = Infinity;
            
            for (const opponentMove of opponentMoves.slice(0, 5)) {
                const opponentScore = this.analyzeMoveLookahead(opponentMove, depth - 1);
                worstOpponentScore = Math.min(worstOpponentScore, opponentScore);
            }
            
            score -= worstOpponentScore * 0.8; // Discount opponent's potential
        }
        
        this.restoreGameState(originalState);
        return score;
    }

    captureGameState() {
        return {
            lines: new Set(this.lines),
            scores: { ...this.scores },
            boxes: this.boxes.map(box => ({ ...box, owner: box.owner }))
        };
    }

    restoreGameState(state) {
        this.lines = state.lines;
        this.scores = state.scores;
        this.boxes = state.boxes;
    }

    simulateMoveExecution(move) {
        const row = parseInt(move.getAttribute('data-row'));
        const col = parseInt(move.getAttribute('data-col'));
        const type = move.getAttribute('data-type');
        const lineId = `${type}-${row}-${col}`;
        
        this.lines.add(lineId);
        
        // Check for completed boxes
        let boxesCompleted = 0;
        const adjacentBoxes = this.getAdjacentBoxes(move);
        
        for (const box of adjacentBoxes) {
            const requiredLines = this.getBoxLines(box);
            const drawnLines = requiredLines.filter(id => this.lines.has(id));
            if (drawnLines.length === 4 && box.owner === null) {
                box.owner = this.currentPlayer;
                boxesCompleted++;
                this.scores[`player${this.currentPlayer}`] = (this.scores[`player${this.currentPlayer}`] || 0) + 1;
            }
        }
        
        return boxesCompleted;
    }

    findMasterChainMove(availableLines) {
        // Advanced chain control and manipulation
        const chains = this.identifyPotentialChains();
        
        // Look for moves that create favorable chain structures
        for (const move of availableLines) {
            const chainValue = this.evaluateChainMove(move, chains);
            if (chainValue >= 5) {
                return move;
            }
        }
        
        return null;
    }

    evaluateChainMove(move, chains) {
        let value = 0;
        const adjacentBoxes = this.getAdjacentBoxes(move);
        
        for (const box of adjacentBoxes) {
            // Check if this move affects any chains
            for (const chain of chains) {
                if (chain.includes(box)) {
                    const linesDrawn = this.countBoxLines(box);
                    
                    if (linesDrawn === 1) {
                        // This would make the box have 2 lines
                        if (chain.length >= 4) {
                            value += 3; // Good to control large chains
                        } else {
                            value -= 1; // Avoid creating small chains for opponent
                        }
                    } else if (linesDrawn === 2) {
                        // This would complete the box
                        value += chain.length; // Value based on chain size
                    }
                }
            }
        }
        
        return value;
    }

    findPerfectMove(availableLines) {
        // Perfect endgame play when few moves remain
        const totalBoxes = (this.gridSize - 1) * (this.gridSize - 1);
        const completedBoxes = this.boxes.filter(b => b.owner !== null).length;
        const remainingBoxes = totalBoxes - completedBoxes;
        
        if (remainingBoxes <= 8) {
            // Use deeper analysis for endgame
            return this.findDeepAnalysisMove(availableLines);
        }
        
        return null;
    }

    findMasterPositionalMove(availableLines) {
        // Master-level positional play
        const positionScores = [];
        
        for (const move of availableLines) {
            let score = 0;
            const danger = this.calculateDanger(move);
            
            if (danger > 5) continue; // Skip dangerous moves
            
            // Evaluate position control
            score += this.evaluatePositionControl(move);
            
            // Evaluate future potential
            score += this.evaluateFuturePotential(move);
            
            // Evaluate defensive value
            score += this.evaluateDefensiveValue(move);
            
            positionScores.push({ move, score });
        }
        
        if (positionScores.length > 0) {
            positionScores.sort((a, b) => b.score - a.score);
            return positionScores[0].move;
        }
        
        return null;
    }

    evaluatePositionControl(move) {
        const row = parseInt(move.getAttribute('data-row'));
        const col = parseInt(move.getAttribute('data-col'));
        const center = Math.floor(this.gridSize / 2);
        
        let score = 0;
        
        // Central control
        const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
        score += Math.max(0, 4 - distanceFromCenter);
        
        // Strategic lines (diagonals, key connections)
        if (row === col || row + col === this.gridSize - 1) {
            score += 2;
        }
        
        return score;
    }

    evaluateFuturePotential(move) {
        let potential = 0;
        const adjacentBoxes = this.getAdjacentBoxes(move);
        
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            const neighbors = this.getNeighborBoxes(box);
            
            // Potential for future chains
            const neighborActivity = neighbors.reduce((sum, neighbor) => {
                return sum + this.countBoxLines(neighbor);
            }, 0);
            
            if (linesDrawn === 0 && neighborActivity >= 2) {
                potential += 2; // Good area to develop
            } else if (linesDrawn === 1 && neighborActivity >= 3) {
                potential += 3; // High potential area
            }
        }
        
        return potential;
    }

    evaluateDefensiveValue(move) {
        let defensive = 0;
        const adjacentBoxes = this.getAdjacentBoxes(move);
        
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            
            if (linesDrawn === 2) {
                // This prevents opponent from getting a box
                const chainSize = this.estimateChainSize(box);
                defensive += chainSize * 2;
            }
        }
        
        return defensive;
    }

    estimateChainSize(box) {
        // Estimate how big a chain starting from this box could be
        const visited = new Set();
        return this.exploreChainSize(box, visited, 0);
    }

    exploreChainSize(box, visited, depth) {
        if (depth > 6 || visited.has(`${box.row}-${box.col}`) || box.owner !== null) {
            return 0;
        }
        
        visited.add(`${box.row}-${box.col}`);
        let size = 1;
        
        const neighbors = this.getNeighborBoxes(box);
        for (const neighbor of neighbors) {
            const neighborLines = this.countBoxLines(neighbor);
            if (neighborLines >= 1) {
                size += this.exploreChainSize(neighbor, visited, depth + 1);
            }
        }
        
        return Math.min(size, 8); // Cap to prevent infinite recursion
    }

    findAdvancedTacticalMove(availableLines) {
        // Advanced tactical considerations
        for (const move of availableLines) {
            const tacticalValue = this.evaluateTacticalMove(move);
            if (tacticalValue >= 4) {
                return move;
            }
        }
        
        return null;
    }

    evaluateTacticalMove(move) {
        let value = 0;
        const adjacentBoxes = this.getAdjacentBoxes(move);
        
        // Look for tactical patterns
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            
            if (linesDrawn === 1) {
                // Check for double-threat creation
                const neighbors = this.getNeighborBoxes(box);
                const threatenedNeighbors = neighbors.filter(n => this.countBoxLines(n) === 2);
                
                if (threatenedNeighbors.length >= 2) {
                    value += 4; // Creates multiple threats
                }
            }
        }
        
        return value;
    }

    // Expert-level Analysis Methods
    calculateChainParity(chains) {
        // Calculate parity for chain control strategy
        let longChains = 0;
        let totalBoxes = 0;
        
        for (const chain of chains) {
            if (chain.length >= 3) {
                longChains++;
                totalBoxes += chain.length;
            }
        }
        
        return {
            longChainCount: longChains,
            totalChainBoxes: totalBoxes,
            parity: longChains % 2
        };
    }

    evaluateChainControl(move, allChains, parity) {
        // Evaluate how this move affects chain control
        let controlValue = 0;
        
        const adjacentBoxes = this.getAdjacentBoxes(move);
        for (const box of adjacentBoxes) {
            for (const chain of allChains) {
                if (chain.includes(box)) {
                    const linesDrawn = this.countBoxLines(box);
                    if (linesDrawn === 2) {
                        // This move starts a chain
                        if (parity.parity === 0) {
                            controlValue += chain.length; // Good if even number of chains
                        } else {
                            controlValue -= chain.length; // Bad if odd number of chains
                        }
                    }
                }
            }
        }
        
        return controlValue;
    }

    calculateParityAdvantage(move) {
        // Calculate how this move affects overall game parity
        const chains = this.identifyAllChains();
        const currentParity = this.calculateChainParity(chains);
        
        // Simulate move and recalculate parity
        const originalState = this.captureGameState();
        this.simulateMoveExecution(move);
        
        const newChains = this.identifyAllChains();
        const newParity = this.calculateChainParity(newChains);
        
        this.restoreGameState(originalState);
        
        // Return parity advantage
        return (newParity.totalChainBoxes - currentParity.totalChainBoxes) * 
               (newParity.parity === 0 ? 1 : -1);
    }

    calculateLongTermGain(move) {
        // Calculate long-term strategic gain from this move
        let gain = 0;
        
        // Chain control gain
        const chains = this.identifyAllChains();
        for (const chain of chains) {
            const adjacentBoxes = this.getAdjacentBoxes(move);
            for (const box of adjacentBoxes) {
                if (chain.includes(box)) {
                    gain += chain.length * 0.3; // Potential future control
                }
            }
        }
        
        // Position control gain
        const strategicValue = this.evaluateStrategicValue(move);
        gain += strategicValue;
        
        return gain;
    }

    calculateOptimalEndgameMove(availableLines) {
        // Perfect endgame calculation using minimax
        let bestMove = null;
        let bestScore = -Infinity;
        
        for (const move of availableLines) {
            const score = this.minimaxEndgame(move, 4, true);
            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }
        
        return bestMove;
    }

    minimaxEndgame(move, depth, isMaximizing) {
        if (depth === 0) {
            return this.evaluateEndgamePosition();
        }
        
        const originalState = this.captureGameState();
        const boxesGained = this.simulateMoveExecution(move);
        
        if (isMaximizing) {
            let maxScore = boxesGained * 10;
            const nextMoves = this.getAvailableLines();
            
            for (const nextMove of nextMoves.slice(0, 3)) {
                const score = this.minimaxEndgame(nextMove, depth - 1, false);
                maxScore = Math.max(maxScore, score);
            }
            
            this.restoreGameState(originalState);
            return maxScore;
        } else {
            let minScore = -boxesGained * 10;
            const nextMoves = this.getAvailableLines();
            
            for (const nextMove of nextMoves.slice(0, 3)) {
                const score = this.minimaxEndgame(nextMove, depth - 1, true);
                minScore = Math.min(minScore, score);
            }
            
            this.restoreGameState(originalState);
            return minScore;
        }
    }

    evaluateEndgamePosition() {
        const myScore = this.scores.player2 || 0;
        const opponentScore = this.scores.player1 || 0;
        return myScore - opponentScore;
    }

    evaluateForcingPower(move) {
        // Evaluate how much this move forces opponent's hand
        const adjacentBoxes = this.getAdjacentBoxes(move);
        let forcingValue = 0;
        
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            if (linesDrawn === 2) {
                // This creates a forced move for opponent
                forcingValue += 2;
                
                // Check if it starts a chain
                const neighbors = this.getNeighborBoxes(box);
                const chainBoxes = neighbors.filter(n => this.countBoxLines(n) >= 2);
                forcingValue += chainBoxes.length;
            }
        }
        
        return forcingValue;
    }

    recognizePatterns() {
        // Recognize common strategic patterns
        const patterns = [];
        
        // Look for T-junctions, triple-forks, etc.
        for (const box of this.boxes) {
            if (box.owner === null) {
                const linesDrawn = this.countBoxLines(box);
                const neighbors = this.getNeighborBoxes(box);
                
                if (linesDrawn === 2 && neighbors.length >= 2) {
                    const neighborLines = neighbors.map(n => this.countBoxLines(n));
                    if (neighborLines.filter(l => l >= 2).length >= 2) {
                        patterns.push({ type: 'junction', box, value: 3 });
                    }
                }
            }
        }
        
        return patterns;
    }

    findMoveForPattern(pattern, availableLines) {
        // Find optimal move for recognized pattern
        if (pattern.type === 'junction') {
            // For junctions, look for moves that control the pattern
            const patternBox = pattern.box;
            const requiredLines = this.getBoxLines(patternBox);
            
            for (const lineId of requiredLines) {
                if (!this.lines.has(lineId)) {
                    const move = this.findLineElementById(lineId, availableLines);
                    if (move) return move;
                }
            }
        }
        
        return null;
    }

    calculateOptimalScore(move) {
        // Calculate comprehensive optimal score for a move
        let score = 0;
        
        // Immediate gain
        const immediateBoxes = this.calculateImmediateGain(move);
        score += immediateBoxes * 10;
        
        // Strategic position value
        score += this.evaluateStrategicValue(move);
        
        // Chain control value
        const chainValue = this.evaluateChainPotential(move);
        score += chainValue;
        
        // Risk penalty
        const risk = this.calculateImmediateRisk(move);
        score -= risk * 8;
        
        return score;
    }

    calculateImmediateGain(move) {
        const adjacentBoxes = this.getAdjacentBoxes(move);
        let gain = 0;
        
        for (const box of adjacentBoxes) {
            const linesDrawn = this.countBoxLines(box);
            if (linesDrawn === 3) {
                gain += 1; // This move completes a box
            }
        }
        
        return gain;
    }

    findLineElementById(lineId, availableLines) {
        const [type, row, col] = lineId.split('-');
        return availableLines.find(line => 
            line.getAttribute('data-type') === type &&
            line.getAttribute('data-row') === row &&
            line.getAttribute('data-col') === col
        );
    }

    returnToWelcome() {
        // Clean up online state if needed
        if (this.lobbyInterval) {
            clearInterval(this.lobbyInterval);
            this.lobbyInterval = null;
        }
        
        // Hide all screens except welcome
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('computer-screen').classList.add('hidden');
        document.getElementById('online-screen').classList.add('hidden');
        document.getElementById('create-room-screen').classList.add('hidden');
        document.getElementById('join-room-screen').classList.add('hidden');
        document.getElementById('room-lobby-screen').classList.add('hidden');
        document.getElementById('welcome-screen').classList.remove('hidden');
    }

    returnToHome() {
        // Clean up online state
        if (this.isOnlineMode) {
            this.leaveRoom();
        }
        
        // Clear intervals
        if (this.lobbyInterval) {
            clearInterval(this.lobbyInterval);
            this.lobbyInterval = null;
        }
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
        
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
        document.getElementById('room-code-popup').classList.add('hidden');
        document.querySelector('.game-container').classList.add('hidden');
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('computer-screen').classList.add('hidden');
        document.getElementById('online-screen').classList.add('hidden');
        document.getElementById('create-room-screen').classList.add('hidden');
        document.getElementById('join-room-screen').classList.add('hidden');
        document.getElementById('room-lobby-screen').classList.add('hidden');
        
        // Show welcome screen
        document.getElementById('welcome-screen').classList.remove('hidden');
        
        // Reset body class
        document.body.className = '';
        document.body.removeAttribute('data-player-count');
    }

    // Premium popup methods
    showPremiumPopup() {
        const popup = document.getElementById('premium-popup');
        if (popup) {
            popup.classList.remove('hidden');
        }
    }

    hidePremiumPopup() {
        const popup = document.getElementById('premium-popup');
        if (popup) {
            popup.classList.add('hidden');
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PinsGame();
});