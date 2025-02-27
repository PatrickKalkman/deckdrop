import { WinChecker } from "./win-checker";
import { EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";
import streamDeck from "@elgato/streamdeck";
import { AIOpponent } from "./ai-opponent";

export class GameLogic {
  // Game board (3 rows × 5 columns)
  private board: number[][] = [
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 0
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 1
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 2
  ]; 
  private currentPlayer: number = PLAYER_ONE;
  private gameOver: boolean = false;
  private winChecker: WinChecker = new WinChecker();
  private aiOpponent: AIOpponent;
  private vsAI: boolean = true; // Play against AI by default
  private aiDelay: number = 2000; // Delay in ms for AI moves
  
  constructor() {
    this.aiOpponent = new AIOpponent();
    this.resetGame();
  }
  
  public getBoard(): number[][] {
    return this.board;
  }
  
  public getCurrentPlayer(): number {
    return this.currentPlayer;
  }
  
  public isGameOver(): boolean {
    return this.gameOver;
  }
  
  /**
   * Set game mode (vs AI or vs human)
   * @param vsAI true to play against AI, false for two human players
   */
  public setVsAI(vsAI: boolean): void {
    this.vsAI = vsAI;
  }
  
  /**
   * Set which player the AI plays as
   * @param aiIsPlayerTwo true if AI is player 2, false if AI is player 1
   */
  public setAIPlayer(aiIsPlayerTwo: boolean): void {
    this.aiOpponent.setIsPlayerTwo(aiIsPlayerTwo);
    
    // If AI is player 1 and it's currently player 1's turn, make AI move
    if (!aiIsPlayerTwo && this.currentPlayer === PLAYER_ONE && this.vsAI && !this.gameOver) {
      this.makeAIMove();
    }
  }
  
  /**
   * Make a move in the specified column
   * @param column The column to place the token in
   * @param onWin Callback function to handle win animation
   * @returns true if the move was successful, false otherwise
   */
  public makeMove(column: number, onWin: (positions: [number, number][], player: number) => void): boolean {
    if (this.gameOver) return false;
    
    // Find the lowest empty row in the column
    let row = -1;
    for (let r = 2; r >= 0; r--) {
      if (this.board[r][column] === EMPTY) {
        row = r;
        break;
      }
    }
    
    // Column is full
    if (row === -1) return false;
    
    // Place token
    this.board[row][column] = this.currentPlayer;
    
    // Log the move for debugging
    streamDeck.logger.info(`Player ${this.currentPlayer} placed at [${row}, ${column}]`);
    streamDeck.logger.info('Current board:', JSON.stringify(this.board));
    
    // Check for winner
    if (this.winChecker.checkWinner(this.board, row, column, onWin)) {
      streamDeck.logger.info(`Player ${this.currentPlayer} wins!`);
      this.gameOver = true;
      return true;
    }
    
    // Check for draw
    if (this.isBoardFull()) {
      streamDeck.logger.info('Game ended in a draw');
      this.gameOver = true;
      return true;
    }
    
    // Switch player
    this.currentPlayer = this.currentPlayer === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
    
    // If AI's turn and game not over, schedule AI move
    if (this.vsAI && !this.gameOver && 
        ((this.aiOpponent.isPlayerTwo && this.currentPlayer === PLAYER_TWO) || 
         (!this.aiOpponent.isPlayerTwo && this.currentPlayer === PLAYER_ONE))) {
      setTimeout(() => this.makeAIMove(), this.aiDelay);
    }
    
    return true;
  }
  
  private makeAIMove(): void {
    if (this.gameOver) return;
    
    const aiColumn = this.aiOpponent.getBestMove(this.board);
    if (aiColumn >= 0 && aiColumn < 5) {
      streamDeck.logger.info(`AI is making move in column ${aiColumn}`);
      
      // We'll use the onWin callback passed to this function
      // This will be called in makeMove if there's a win
      const onWinCallback = (positions: [number, number][], player: number) => {
        this.onWinHandler?.(positions, player);
      };
      
      // Make the move
      const moveResult = this.makeMove(aiColumn, onWinCallback);
      
      // Ensure the board is rendered after AI makes a move
      if (this.renderCallback) {
        this.renderCallback(this.board);
      }
    } else {
      streamDeck.logger.error(`AI returned invalid column: ${aiColumn}`);
    }
  }

  // Add a new property to store the render callback
  private renderCallback?: (board: number[][]) => void;
  
  /**
   * Set a callback function to render the board after AI moves
   * @param callback The function to call to render the board
   */
  public setRenderCallback(callback: (board: number[][]) => void): void {
    this.renderCallback = callback;
  }
  
  // Store the onWin handler for AI moves
  private onWinHandler?: (positions: [number, number][], player: number) => void;
  
  /**
   * Set the onWin handler for the game
   * @param handler The function to call when a player wins
   */
  public setOnWinHandler(handler: (positions: [number, number][], player: number) => void): void {
    this.onWinHandler = handler;
  }
  
  /**
   * Reset the game
   */
  public resetGame(): void {
    this.board = [
      [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 0
      [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 1
      [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 2
    ];
    this.currentPlayer = PLAYER_ONE;
    this.gameOver = false;
    streamDeck.logger.info('Game reset');

    if (this.renderCallback) {
      this.renderCallback(this.board);
    }
    
    // If AI is player 1, make AI move
    if (this.vsAI && !this.aiOpponent.isPlayerTwo) {
      setTimeout(() => this.makeAIMove(), this.aiDelay);
    }
  }
  
  /**
   * Check if the board is full (draw condition)
   */
  private isBoardFull(): boolean {
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 3; r++) {
        if (this.board[r][c] === EMPTY) {
          return false;
        }
      }
    }
    return true;
  }
}