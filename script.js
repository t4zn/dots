class PinsGame {
    constructor() {
        this.gridSize = 6; // Default 6x6 grid of dots
        this.currentPlayer = 1;
        this.scores = { player1: 0, player2: 0 };
        this.lines = new Set();
        this.drawnLines = new Map(); // Track which player drew each line
        this.lastDrawnLine = null; // Track the most recent line
        this.boxes = [];
        this.gameOver = false;
        this.gameStarted = false;
        this.turnTextTimeout = null; // Track timeout for turn text
        
        this.initializeGame();
        this.setupEventListeners();
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
        
        // Create dots
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                dot.setAttribute('cx', offset + col * spacing);
                dot.setAttribute('cy', offset + row * spacing);
                dot.setAttribute('r', 6);
                dot.setAttribute('class', 'dot');
                // Force solid black with inline styles
                dot.setAttribute('fill', '#000000');
                dot.setAttribute('stroke', 'none');
                dot.setAttribute('stroke-width', '0');
                dot.style.fill = '#000000';
                dot.style.stroke = 'none';
                dot.style.opacity = '1';
                dot.style.pointerEvents = 'none'; // Disable click events on dots
                svg.appendChild(dot);
            }
        }
        
        // Create horizontal lines
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize - 1; col++) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const dotRadius = 6;
                const x1 = offset + col * spacing + dotRadius;
                const y1 = offset + row * spacing;
                const x2 = offset + (col + 1) * spacing - dotRadius;
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
                const dotRadius = 6;
                const x1 = offset + col * spacing;
                const y1 = offset + row * spacing + dotRadius;
                const x2 = offset + col * spacing;
                const y2 = offset + (row + 1) * spacing - dotRadius;
                
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
                const dotRadius = 6;
                const lineWidth = 8; // Match the line stroke width
                const x = offset + col * spacing + dotRadius - (lineWidth / 2);
                const y = offset + row * spacing + dotRadius;
                const width = spacing - (dotRadius * 2) + lineWidth;
                const height = spacing - (dotRadius * 2);
                
                box.setAttribute('x', x);
                box.setAttribute('y', y);
                box.setAttribute('width', width);
                box.setAttribute('height', height);
                box.setAttribute('class', 'box');
                box.setAttribute('data-row', row);
                box.setAttribute('data-col', col);
                box.setAttribute('rx', 8);
                box.style.pointerEvents = 'none'; // Disable click events on boxes
                
                svg.appendChild(box);
                this.boxes.push({ element: box, row, col, owner: null });
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
            this.lastDrawnLine.classList.remove('player1-line', 'player2-line', 'current-player-line');
            this.lastDrawnLine.classList.add('drawn');
        }
        
        // Add line to drawn lines and track the player
        this.lines.add(lineId);
        this.drawnLines.set(lineId, this.currentPlayer);
        this.lastDrawnLine = lineElement;
        
        // Remove hover classes and add current player line class
        lineElement.classList.remove('player1-hover', 'player2-hover');
        lineElement.classList.add(`player${this.currentPlayer}-line`, 'current-player-line');
        
        // Add animation
        const totalLength = lineElement.getTotalLength();
        lineElement.style.strokeDasharray = totalLength;
        lineElement.style.strokeDashoffset = totalLength;
        
        const animation = lineElement.animate([
            { strokeDashoffset: totalLength },
            { strokeDashoffset: 0 }
        ], {
            duration: 400,
            easing: 'ease-out'
        });
        
        // After animation, keep the line visible
        animation.addEventListener('finish', () => {
            lineElement.style.strokeDasharray = 'none';
            lineElement.style.strokeDashoffset = '0';
        });
        
        // Check for completed boxes
        const completedBoxes = this.checkCompletedBoxes();
        let playerGetsAnotherTurn = false;
        
        if (completedBoxes.length > 0) {
            playerGetsAnotherTurn = true;
            completedBoxes.forEach(box => {
                box.owner = this.currentPlayer;
                box.element.classList.add('filled');
                box.element.classList.add(`player${this.currentPlayer}-box`);
                this.scores[`player${this.currentPlayer}`]++;
            });
        }
        
        // Switch player if no boxes were completed
        if (!playerGetsAnotherTurn) {
            this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        }
        
        this.updateUI();
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
    
    updateUI() {
        document.getElementById('player1-score').textContent = this.scores.player1;
        document.getElementById('player2-score').textContent = this.scores.player2;
        
        // Update body background based on current player
        document.body.className = `player${this.currentPlayer}-turn`;
        
        // Update player indicators
        const player1Indicator = document.getElementById('player1-indicator');
        const player2Indicator = document.getElementById('player2-indicator');
        
        if (this.currentPlayer === 1) {
            player1Indicator.classList.add('active');
            player2Indicator.classList.remove('active');
        } else {
            player2Indicator.classList.add('active');
            player1Indicator.classList.remove('active');
        }
        
        // No turn text needed anymore
    }
    
    // Removed showTurnText function - no longer needed
    
    updateLineHover() {
        // This function is no longer needed since we removed hover effects
        // that were causing unwanted color changes
    }
    

    
    checkGameEnd() {
        const totalPossibleBoxes = (this.gridSize - 1) * (this.gridSize - 1);
        const claimedBoxes = this.scores.player1 + this.scores.player2;
        
        if (claimedBoxes === totalPossibleBoxes) {
            this.gameOver = true;
            this.showGameOverModal();
        }
    }
    
    showGameOverModal() {
        const modal = document.getElementById('game-over-modal');
        const winnerText = document.getElementById('winner-text');
        
        if (this.scores.player1 > this.scores.player2) {
            winnerText.textContent = 'Player 1 Wins!';
            winnerText.style.color = '#3b82f6';
        } else if (this.scores.player2 > this.scores.player1) {
            winnerText.textContent = 'Player 2 Wins!';
            winnerText.style.color = '#ef4444';
        } else {
            winnerText.textContent = "It's a Draw!";
            winnerText.style.color = '#636e72';
        }
        
        modal.classList.remove('hidden');
    }
    
    restartGame() {
        this.currentPlayer = 1;
        this.scores = { player1: 0, player2: 0 };
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
    
    showMenu() {
        document.getElementById('menu-modal').classList.remove('hidden');
    }
    
    hideMenu() {
        document.getElementById('menu-modal').classList.add('hidden');
    }
    
    setupEventListeners() {
        // Menu button
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.showMenu();
        });
        
        // Menu options
        document.getElementById('resume-btn').addEventListener('click', () => {
            this.hideMenu();
        });
        
        document.getElementById('restart-game-btn').addEventListener('click', () => {
            this.restartGame();
        });
        
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.restartGame();
        });
        
        // Grid size buttons
        document.querySelectorAll('.grid-size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.size);
                this.changeGridSize(size);
            });
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
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PinsGame();
});