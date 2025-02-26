import streamDeck, { 
  action, 
  KeyDownEvent, 
  SingletonAction, 
  WillAppearEvent,
  WillDisappearEvent
} from "@elgato/streamdeck";
import { WinChecker } from "./win-checker";
import { GameRenderer, EMPTY, PLAYER_ONE, PLAYER_TWO } from "./game-renderer";

type GameSettings = {
  currentPlayer: number; 
  gameOver: boolean;
  isController: boolean; // Flag to identify controller button
};

// Store actions by coordinates for later lookup
type CoordinateKey = string;
type ActionMap = Map<CoordinateKey, any>;

@action({ UUID: "com.practical-engineer.deckdrop.game" })
export class DeckDropGame extends SingletonAction<GameSettings> {
  // Game board (3 rows × 5 columns)
  private board: number[][] = [
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 0
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 1
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 2
  ];
  
  private currentPlayer: number = PLAYER_ONE;
  private gameOver: boolean = false;
  private winChecker: WinChecker = new WinChecker();
  private renderer: GameRenderer;

  // Map to store actions by coordinates
  private actionLookup: ActionMap = new Map();

  constructor() {
    super();
    this.renderer = new GameRenderer(this.actionLookup);
  }
  
  // Helper to create coordinate key
  private getCoordinateKey(row: number, col: number): CoordinateKey {
    return `${row},${col}`;
  }

  /**
   * Occurs when the action appears on Stream Deck
   */
  override async onWillAppear(ev: WillAppearEvent<GameSettings>): Promise<void> {
    // Log event info for debugging
    streamDeck.logger.info('Action appeared:', {
      actionId: ev.action.id,
      coordinates: ev.action.coordinates,
      settings: ev.payload.settings
    });
    
    // Store action reference in our lookup map if it has coordinates
    if (ev.action.coordinates) {
      const col = ev.action.coordinates.column;
      const row = ev.action.coordinates.row;
      const key = this.getCoordinateKey(row, col);
      this.actionLookup.set(key, ev.action);
      streamDeck.logger.info(`Stored action at coordinates [${row}, ${col}]`);
    }
    
    // Load game state from settings if available
    this.currentPlayer = ev.payload.settings.currentPlayer;
    this.gameOver = ev.payload.settings.gameOver;

    
    // Switch to the DeckDrop profile if we haven't already
    if (!this.hasProfileSwitched) {
      try {
        await streamDeck.profiles.switchToProfile(ev.action.device.id, "DeckDrop");
        this.hasProfileSwitched = true;
        streamDeck.logger.info('Switched to DeckDrop profile');
      } catch (error) {
        streamDeck.logger.error(`Failed to switch profile: ${error}`);
      }
    }
  }

  // Track if we've already switched to the DeckDrop profile
  private hasProfileSwitched: boolean = false;
  
  override async onWillDisappear(ev: WillDisappearEvent<GameSettings>): Promise<void> {
    // Find and remove the action from our lookup map
    for (const [key, storedAction] of this.actionLookup.entries()) {
      if (storedAction.id === ev.action.id) {
        this.actionLookup.delete(key);
        streamDeck.logger.info(`Removed action with ID ${ev.action.id} from lookup map`);
        break;
      }
    }
    
    streamDeck.logger.info('Action disappeared');
  }

  override async onKeyDown(ev: KeyDownEvent<GameSettings>): Promise<void> {

    streamDeck.logger.info('Key pressed:', {
      actionId: ev.action.id,
      coordinates: ev.action.coordinates,
      settings: ev.payload.settings
    });

    // Check if the pressed button is in the top row (row=0)
    if (ev.action.coordinates && ev.action.coordinates.row === 0) {
      const column = ev.action.coordinates.column;
      this.makeMove(column);
      this.renderer.renderBoard(this.board);
    } else {
      // If it's not a button in the top row, do nothing
      streamDeck.logger.info('Button not in top row, no action taken');
    }
  }

  /**
   * Make a move in the specified column
   */
  private makeMove(column: number): boolean {
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
    if (this.winChecker.checkWinner(this.board, row, column, this.renderer.showWinner.bind(this.renderer))) {
      streamDeck.logger.info(`Player ${this.currentPlayer} wins!`);
      this.gameOver = true;
      // Game will be reset after the winner animation completes
      setTimeout(() => {
        this.resetGame();
        this.renderer.renderBoard(this.board);
        }, 5000); // Wait for animation to complete (5 seconds)

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
  private resetGame(): void {
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
