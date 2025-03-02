import streamDeck from "@elgato/streamdeck";
import { EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";

// Default number of MCTS simulations to run
export const DEFAULT_MCTS_SIMULATIONS = 10000;

// MCTSNode represents a state in the game
class MCTSNode {
  state: number[][];
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedMoves: number[];
  playerJustMoved: number;

  constructor(state: number[][], parent: MCTSNode | null, playerJustMoved: number) {
    this.state = state;
    this.parent = parent;
    this.children = [];
    this.visits = 0;
    this.wins = 0;
    this.untriedMoves = this.getValidMoves(state);
    this.playerJustMoved = playerJustMoved;
  }

  // Get valid moves for the current state (columns that aren't full)
  getValidMoves(board: number[][]): number[] {
    const validMoves: number[] = [];
    for (let col = 0; col < 5; col++) {
      if (board[0][col] === EMPTY) {
        validMoves.push(col);
      }
    }
    return validMoves;
  }

  // UCB1 formula for node selection
  // C parameter balances exploration vs exploitation
  getUCB1(explorationConstant: number): number {
    if (this.visits === 0) {
      return Infinity;
    }
    return (this.wins / this.visits) + 
           explorationConstant * Math.sqrt(2 * Math.log(this.parent?.visits || 1) / this.visits);
  }

  // Select a child with highest UCB1 value
  selectChild(explorationConstant: number): MCTSNode {
    let selectedChild = null;
    let bestScore = -Infinity;

    for (const child of this.children) {
      const ucb = child.getUCB1(explorationConstant);
      if (ucb > bestScore) {
        selectedChild = child;
        bestScore = ucb;
      }
    }

    return selectedChild!;
  }

  // Add a new child node for the specified move
  addChild(move: number, nextState: number[][]): MCTSNode {
    // After a move, the player changes
    const nextPlayer = this.playerJustMoved === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
    const childNode = new MCTSNode(nextState, this, nextPlayer);
    
    // Remove the move from untried moves
    this.untriedMoves = this.untriedMoves.filter(m => m !== move);
    
    // Add to children
    this.children.push(childNode);
    return childNode;
  }

  // Check if node is fully expanded
  isFullyExpanded(): boolean {
    return this.untriedMoves.length === 0;
  }

  // Check if node is terminal (game over)
  isTerminal(): boolean {
    return this.checkWin(this.state, PLAYER_ONE) || 
           this.checkWin(this.state, PLAYER_TWO) || 
           this.isBoardFull(this.state);
  }

  // Check if the board is full
  isBoardFull(board: number[][]): boolean {
    for (let col = 0; col < 5; col++) {
      if (board[0][col] === EMPTY) {
        return false;
      }
    }
    return true;
  }

  // Check if the specified player has won
  checkWin(board: number[][], player: number): boolean {
    // Check horizontal
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col <= 2; col++) {
        if (
          board[row][col] === player &&
          board[row][col + 1] === player &&
          board[row][col + 2] === player
        ) {
          return true;
        }
      }
    }

    // Check vertical
    for (let row = 0; row <= 0; row++) {
      for (let col = 0; col < 5; col++) {
        if (
          board[row][col] === player &&
          board[row + 1][col] === player &&
          board[row + 2][col] === player
        ) {
          return true;
        }
      }
    }

    // Check diagonal (down-right)
    for (let row = 0; row <= 0; row++) {
      for (let col = 0; col <= 2; col++) {
        if (
          board[row][col] === player &&
          board[row + 1][col + 1] === player &&
          board[row + 2][col + 2] === player
        ) {
          return true;
        }
      }
    }

    // Check diagonal (up-right)
    // Fixed: This loop should iterate through rows 2 to 0
    for (let row = 2; row >= 0; row--) {
      // Only check diagonals that fit within the board
      if (row >= 2) {
        for (let col = 0; col <= 2; col++) {
          if (
            board[row][col] === player &&
            board[row - 1][col + 1] === player &&
            board[row - 2][col + 2] === player
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }
}

export class MCTSOpponent {
  public isPlayerTwo: boolean = true; // AI is player 2 by default
  private simulationCount: number = DEFAULT_MCTS_SIMULATIONS;
  private explorationConstant: number = 1.2; // Slightly reduced to favor exploitation

  constructor(simulationCount: number = DEFAULT_MCTS_SIMULATIONS) {
    this.simulationCount = simulationCount;
    streamDeck.logger.info(`Created MCTS opponent with ${simulationCount} simulations`);
  } 

  /**
   * Get the best action (column) for the current board state using MCTS
   * @param board Current game board
   * @returns Column index (0-4) for the best move
   */
  public getBestMove(board: number[][]): number {
    // Create a copy of the board to avoid modifying the original
    const boardCopy = this.cloneBoard(board);
    
    // Determine which player is moving now
    const currentPlayer = this.isPlayerTwo ? PLAYER_TWO : PLAYER_ONE;
    
    // The previous player would be the opposite
    const prevPlayer = currentPlayer === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
    
    // Create root node
    const rootNode = new MCTSNode(boardCopy, null, prevPlayer);
    
    // Handle special case: if there's a winning move, take it
    const winningMove = this.findWinningMove(boardCopy, currentPlayer);
    if (winningMove !== -1) {
      streamDeck.logger.info(`MCTS found immediate winning move at column ${winningMove}`);
      return winningMove;
    }
    
    // Handle special case: if opponent has a winning move, block it
    const blockingMove = this.findWinningMove(boardCopy, prevPlayer);
    if (blockingMove !== -1) {
      streamDeck.logger.info(`MCTS blocking opponent's winning move at column ${blockingMove}`);
      return blockingMove;
    }
    
    // Handle special case: first move preference for middle columns
    if (this.isBoardEmpty(boardCopy)) {
      const centerCol = 2; // Middle column (0-based index)
      streamDeck.logger.info(`MCTS using opening book move at column ${centerCol}`);
      return centerCol;
    }
    
    // Run MCTS for a fixed number of simulations
    const startTime = Date.now();
    const maxTime = 1000; // Cap at 1 second to ensure responsiveness
    
    let simCount = 0;
    while (simCount < this.simulationCount && (Date.now() - startTime) < maxTime) {
      simCount++;
      
      // Phase 1: Selection
      let node = rootNode;
      
      // Select until we reach a leaf node or a node that's not fully expanded
      while (!node.isTerminal() && node.isFullyExpanded()) {
        node = node.selectChild(this.explorationConstant);
      }
      
      // Phase 2: Expansion
      if (!node.isTerminal() && !node.isFullyExpanded()) {
        // Choose an untried move
        const move = node.untriedMoves[Math.floor(Math.random() * node.untriedMoves.length)];
        
        // Create new board state after this move
        const nextState = this.makeMove(this.cloneBoard(node.state), move, 
          node.playerJustMoved === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE);
        
        // Add child node
        node = node.addChild(move, nextState);
      }
      
      // Phase 3: Simulation (rollout)
      let state = this.cloneBoard(node.state);
      let playerJustMoved = node.playerJustMoved;
      
      // Play with improved heuristic until the game ends
      while (!this.isGameOver(state)) {
        const validMoves = this.getValidMoves(state);
        if (validMoves.length === 0) break;
        
        // Next player
        const nextPlayer = playerJustMoved === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
        
        // Use heuristic for more intelligent play
        const move = this.getHeuristicMove(state, nextPlayer, validMoves);
        playerJustMoved = nextPlayer;
        state = this.makeMove(state, move, playerJustMoved);
      }
      
      // Phase 4: Backpropagation
      // Simplified win determination logic
      const winner = this.getWinner(state);
      
      while (node !== null) {
        node.visits++;
        
        // We update wins from the perspective of the player who just moved in this node
        if (winner === 0) {
          // Draw
          node.wins += 0.5;
        } else if (winner === node.playerJustMoved) {
          // Player who just moved in this node won
          node.wins += 1.0;
        }
        // If opponent won, leave wins unchanged (add 0)
        
        if (node.parent !== null) {
          node = node.parent;
        } else {
          break;
        }
      }
    }
    
    // Combine win rate and visit count for decision
    let bestMove = -1;
    let bestScore = -Infinity;
    
    // Log results for debugging
    streamDeck.logger.info(`MCTS ran ${simCount} simulations in ${Date.now() - startTime}ms`);
    
    for (const child of rootNode.children) {
      const move = this.findMove(rootNode.state, child.state);
      const winRate = child.visits > 0 ? child.wins / child.visits : 0;
      
      // Score based on win rate and visit count
      // This balances both factors
      const score = winRate + (0.1 * child.visits / simCount);
      
      streamDeck.logger.info(`Move: ${move}, Visits: ${child.visits}, Win rate: ${winRate.toFixed(3)}, Score: ${score.toFixed(3)}`);
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    if (bestMove === -1 && rootNode.untriedMoves.length > 0) {
      // If no best move found but there are untried moves, pick the middle one
      const validMoves = rootNode.untriedMoves;
      bestMove = this.centerPreference(validMoves);
    }
    
    streamDeck.logger.info(`MCTS selected column ${bestMove} with score ${bestScore.toFixed(3)}`);
    return bestMove;
  }
  
  /**
   * Set which player the AI plays as
   * @param isPlayerTwo true if AI is player 2, false if AI is player 1
   */
  public setIsPlayerTwo(isPlayerTwo: boolean): void {
    this.isPlayerTwo = isPlayerTwo;
  }
  
  /**
   * Set number of simulations to run
   * @param count Number of simulations
   */
  public setSimulationCount(count: number): void {
    this.simulationCount = count;
  }
  
  // Helper methods
  
  /**
   * Prefer central columns when multiple options are available
   */
  private centerPreference(moves: number[]): number {
    if (moves.length === 0) return -1;
    
    // Column preference: 2 (center), then 1, 3, 0, 4 (edges)
    const preferenceOrder = [2, 1, 3, 0, 4];
    
    for (const col of preferenceOrder) {
      if (moves.includes(col)) {
        return col;
      }
    }
    
    return moves[0]; // Fallback
  }
  
  /**
   * Find a winning move for the given player if one exists
   * @returns Column index of winning move or -1 if none exists
   */
  private findWinningMove(board: number[][], player: number): number {
    const validMoves = this.getValidMoves(board);
    
    for (const move of validMoves) {
      const nextBoard = this.makeMove(this.cloneBoard(board), move, player);
      if (this.checkWin(nextBoard, player)) {
        return move;
      }
    }
    
    return -1;
  }
  
  /**
   * Check if board is completely empty (first move)
   */
  private isBoardEmpty(board: number[][]): boolean {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        if (board[row][col] !== EMPTY) {
          return false;
        }
      }
    }
    return true;
  }
  
  /**
   * Get winner of the game (0 for draw, PLAYER_ONE or PLAYER_TWO for winner)
   */
  private getWinner(board: number[][]): number {
    if (this.checkWin(board, PLAYER_ONE)) return PLAYER_ONE;
    if (this.checkWin(board, PLAYER_TWO)) return PLAYER_TWO;
    return 0; // Draw or game not finished
  }
  
  /**
   * Choose a move using heuristics for more intelligent simulation
   */
  private getHeuristicMove(board: number[][], player: number, validMoves: number[]): number {
    // 1. If there's a winning move, take it
    for (const move of validMoves) {
      const nextBoard = this.makeMove(this.cloneBoard(board), move, player);
      if (this.checkWin(nextBoard, player)) {
        return move;
      }
    }
    
    // 2. If opponent has a winning move, block it
    const opponent = player === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
    for (const move of validMoves) {
      const nextBoard = this.makeMove(this.cloneBoard(board), move, opponent);
      if (this.checkWin(nextBoard, opponent)) {
        return move;
      }
    }
    
    // 3. Choose randomly with preference for the center columns
    if (Math.random() < 0.8) {
      return this.centerPreference(validMoves);
    } else {
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }
  }
  
  private cloneBoard(board: number[][]): number[][] {
    return board.map(row => [...row]);
  }
  
  private getValidMoves(board: number[][]): number[] {
    const validMoves: number[] = [];
    for (let col = 0; col < 5; col++) {
      if (board[0][col] === EMPTY) {
        validMoves.push(col);
      }
    }
    return validMoves;
  }
  
  private makeMove(board: number[][], column: number, player: number): number[][] {
    const newBoard = this.cloneBoard(board);
    
    // Find the lowest empty row in the column
    let row = -1;
    for (let r = 2; r >= 0; r--) {
      if (newBoard[r][column] === EMPTY) {
        row = r;
        break;
      }
    }
    
    if (row !== -1) {
      newBoard[row][column] = player;
    }
    
    return newBoard;
  }
  
  private findMove(oldState: number[][], newState: number[][]): number {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 3; row++) {
        if (oldState[row][col] !== newState[row][col]) {
          return col;
        }
      }
    }
    return -1;
  }
  
  private isGameOver(board: number[][]): boolean {
    return this.checkWin(board, PLAYER_ONE) || 
           this.checkWin(board, PLAYER_TWO) || 
           this.isBoardFull(board);
  }
  
  private isBoardFull(board: number[][]): boolean {
    for (let col = 0; col < 5; col++) {
      if (board[0][col] === EMPTY) {
        return false;
      }
    }
    return true;
  }
  
  private checkWin(board: number[][], player: number): boolean {
    // Check horizontal
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col <= 2; col++) {
        if (
          board[row][col] === player &&
          board[row][col + 1] === player &&
          board[row][col + 2] === player
        ) {
          return true;
        }
      }
    }

    // Check vertical
    for (let row = 0; row <= 0; row++) {
      for (let col = 0; col < 5; col++) {
        if (
          board[row][col] === player &&
          board[row + 1][col] === player &&
          board[row + 2][col] === player
        ) {
          return true;
        }
      }
    }

    // Check diagonal (down-right)
    for (let row = 0; row <= 0; row++) {
      for (let col = 0; col <= 2; col++) {
        if (
          board[row][col] === player &&
          board[row + 1][col + 1] === player &&
          board[row + 2][col + 2] === player
        ) {
          return true;
        }
      }
    }

    // Check diagonal (up-right) - FIXED
    for (let row = 2; row >= 0; row--) {
      // Only check diagonals that fit within the board
      if (row >= 2) {
        for (let col = 0; col <= 2; col++) {
          if (
            board[row][col] === player &&
            board[row - 1][col + 1] === player &&
            board[row - 2][col + 2] === player
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
