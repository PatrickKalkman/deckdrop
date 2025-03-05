import { WinChecker } from "./win-checker";
import { EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";
import streamDeck from "@elgato/streamdeck";
import { AIOpponent } from "./ai-opponent";
import { DEFAULT_GROQ_MODEL } from "./groq-opponent";

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
  private aiOpponent: AIOpponent; // Initialize in constructor
  private vsAI: boolean = true; // Play against AI by default
  private aiDelay: number = 500; // Delay in ms for AI moves

  private gameOverCallback?: () => void;
  
  constructor(strategyType: 'qlearning' | 'mcts' | 'groq' = 'mcts', 
              options: { mctsSimulations?: number, groqApiKey?: string, groqModel?: string } = {}) {
    // Create the AI opponent with the specified strategy
    this.aiOpponent = new AIOpponent(strategyType, options);
    streamDeck.logger.info(`Created AI Opponent with ${strategyType} strategy`);
  }

  /**
   * Set the AI strategy to use
   * @param strategy The strategy to use ('qlearning', 'mcts', or 'groq')
   * @param options Additional options for the strategy
   */
  public setAIStrategy(
    strategy: 'qlearning' | 'mcts' | 'groq', 
    options: { mctsSimulations?: number, groqApiKey?: string, groqModel?: string } = {}
  ): void {
    // Update the AI opponent's strategy
    this.aiOpponent.setStrategy(strategy, options);
    
    let logMessage = `Set AI strategy to ${strategy}`;
    if (strategy === 'mcts' && options.mctsSimulations) {
      logMessage += ` with ${options.mctsSimulations} simulations`;
    } else if (strategy === 'groq') {
      logMessage += ` with model ${options.groqModel || DEFAULT_GROQ_MODEL}`;
    }
    
    streamDeck.logger.info(logMessage);
  }
  
  /**
   * Configure the current AI strategy with additional options
   * @param options Options specific to the current strategy
   */
  public configureAIStrategy(options: {
    mctsSimulations?: number,
    groqApiKey?: string,
    groqModel?: string
  }): void {
    this.aiOpponent.configureStrategy(options);
  }
  
  /**
   * Set a callback function to handle game over state
   * @param callback The function to call when the game is over
   */
  public setGameOverCallback(callback: () => void): void {
    this.gameOverCallback = callback;
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
      setTimeout(() => {
        this.makeAIMove().catch(error => {
          streamDeck.logger.error(`Error in scheduled AI move: ${error}`);
        });
      }, this.aiDelay);
    }
    
    return true;
  }
  
  private async makeAIMove(): Promise<void> {
    if (this.gameOver) return;
    
    try {
      // Get the AI's move (now async)
      const aiColumn = await this.aiOpponent.getBestMove(this.board);
      
      if (aiColumn >= 0 && aiColumn < 5) {
        streamDeck.logger.info(`AI is making move in column ${aiColumn}`);
        
        // Important: Use the stored onWinHandler directly 
        // to ensure same callback for both players
        const moveResult = this.makeMove(aiColumn, this.onWinHandler || (() => {}));
        
        // Ensure the board is rendered after AI makes a move
        if (this.renderCallback) {
          this.renderCallback(this.board);
        }
        
        // If the game is now over, trigger the game over callback
        if (moveResult && this.gameOver && this.gameOverCallback) {
          streamDeck.logger.info("AI move ended the game, triggering game over callback");
          this.gameOverCallback();
        }
      } else {
        streamDeck.logger.error(`AI returned invalid column: ${aiColumn}`);
      }
    } catch (error) {
      streamDeck.logger.error(`Error during AI move: ${error}`);
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
   * @returns Promise that resolves when the reset is complete
   */
  public async resetGame(): Promise<void> {
    streamDeck.logger.info('Resetting game...');
    
    // Reset game state
    this.board = [
      [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 0
      [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 1
      [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 2
    ];
    this.currentPlayer = PLAYER_ONE;
    this.gameOver = false;
    
    // Force-render the board and ensure it completes before continuing
    if (this.renderCallback) {
      streamDeck.logger.info('Rendering reset board');
      
      // Store the callback in a local variable to satisfy TypeScript
      const renderCallback = this.renderCallback;
      
      // Ensure the render completes by wrapping in a Promise
      await new Promise<void>((resolve) => {
        // Call the render callback (we know it exists since we captured it)
        renderCallback(this.board);
        
        // Add a short delay to ensure rendering completes
        setTimeout(() => {
          resolve();
        }, 100);
      });
    }
    
    streamDeck.logger.info('Game reset complete');
    
    // If AI is player 1, make AI move after ensuring board is rendered
    if (this.vsAI && !this.aiOpponent.isPlayerTwo) {
      streamDeck.logger.info('Scheduling AI move after reset');
      setTimeout(() => {
        this.makeAIMove().catch(error => {
          streamDeck.logger.error(`Error in AI move after reset: ${error}`);
        });
      }, this.aiDelay);
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
