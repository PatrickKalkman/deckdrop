import { WinChecker } from "./win-checker";
import { EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";
import streamDeck from "@elgato/streamdeck";

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
  
  constructor() {}
  
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
    return true;
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
