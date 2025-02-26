import streamDeck, { 
  action, 
  KeyDownEvent, 
  SingletonAction, 
  WillAppearEvent,
  WillDisappearEvent
} from "@elgato/streamdeck";

// Game states
const EMPTY = 0; 
const PLAYER_ONE = 1;
const PLAYER_TWO = 2;

type GameSettings = {
  gameState: number[][];
  currentPlayer: number; 
  gameOver: boolean;
  isController: boolean; // Flag to identify controller button
};

// Store actions by coordinates for later lookup
type CoordinateKey = string;
type ActionMap = Map<CoordinateKey, any>;

@action({ UUID: "com.practical-engineer.deckdrop.game" })
export class DeckDropGame extends SingletonAction<GameSettings> {
  // Game board (5 rows × 3 columns)
  private board: number[][] = [
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 0
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 1
    [EMPTY, EMPTY, EMPTY, EMPTY, EMPTY], // Row 2
  ];
  
  private currentPlayer: number = PLAYER_ONE;
  private gameOver: boolean = false;
  
  // Map to store actions by coordinates
  private actionLookup: ActionMap = new Map();
  
  // Helper to create coordinate key
  private getCoordinateKey(col: number, row: number): CoordinateKey {
    return `${col},${row}`;
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
      const key = this.getCoordinateKey(col, row);
      this.actionLookup.set(key, ev.action);
      streamDeck.logger.info(`Stored action at coordinates [${col}, ${row}]`);
    }
    
    // Load game state from settings if available
    if (ev.payload.settings?.gameState) {
      this.board = ev.payload.settings.gameState;
      this.currentPlayer = ev.payload.settings.currentPlayer;
      this.gameOver = ev.payload.settings.gameOver;
      
      streamDeck.logger.info('Loaded saved game state');
    } else {
      // Initialize new game
      this.resetGame();
      
      // Save initial game state
      await this.saveGameState(ev.action);
      streamDeck.logger.info('Initialized new game');
    }
    
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
  
  /**
   * Occurs when the action's key is pressed down
   */
  /**
   * Occurs when the action disappears from Stream Deck
   */
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
    // Log key press for debugging
    streamDeck.logger.info('Key pressed:', {
      actionId: ev.action.id,
      coordinates: ev.action.coordinates,
      settings: ev.payload.settings
    });

    // Check if the pressed button is in the top row (row=0)
    if (ev.action.coordinates && ev.action.coordinates.row === 0) {
      const column = ev.action.coordinates.column;
       
      // Find the action at the same column but last row (row=2)
      const targetKey = this.getCoordinateKey(column, 2);
      const targetAction = this.actionLookup.get(targetKey);
      
      if (targetAction) {
        // Change the state of the target action to 1
        targetAction.setImage('imgs/actions/deckdrop/red-token-in-slot.svg');
        streamDeck.logger.info(`Changed button at [${column}, 2] to 1`);
      } else {
        streamDeck.logger.info(`No action found at coordinates [${column}, 2]`);
      }
    } else {
      // If it's not a button in the top row, do nothing
      streamDeck.logger.info('Button not in top row, no action taken');
    }
  }
  
  /**
   * Toggle cell state between empty and specified player
   */
  private toggleCellState(col: number, row: number, player: number = PLAYER_ONE): void {
    // Ensure column and row are within bounds
    if (col < 0 || col >= 5 || row < 0 || row >= 3) {
      streamDeck.logger.info(`Invalid coordinates: [${col}, ${row}]`);
      return;
    }
    
    // Toggle between empty and specified player
    this.board[col][row] = this.board[col][row] === EMPTY ? player : EMPTY;
    
    streamDeck.logger.info(`Toggled cell at [${col}, ${row}] to ${this.board[col][row]}`);
    streamDeck.logger.info('Current board:', JSON.stringify(this.board));
  }

/**
 * Force all buttons to refresh by switching profiles
 */
private async refreshDeck(action: any): Promise<void> {
  try {
    const deviceId = action.device.id;
    
    // Save game state before refreshing
    await this.saveGameState(action);
    
    // Switch to the same profile to force a refresh of all buttons
    await streamDeck.profiles.switchToProfile(deviceId);
    
    streamDeck.logger.info('Refreshed deck');
  } catch (error) {
    streamDeck.logger.error('Failed to refresh deck:', error);
  }
}

  /**
   * Make a move in the specified column
   */
  private makeMove(column: number): boolean {
    // Find the lowest empty row in the column
    let row = -1;
    for (let r = 2; r >= 0; r--) {
      if (this.board[column][r] === EMPTY) {
        row = r;
        break;
      }
    }
    
    // Column is full
    if (row === -1) return false;
    
    // Place token
    this.board[column][row] = this.currentPlayer;
    
    // Log the move for debugging
    streamDeck.logger.info(`Player ${this.currentPlayer} placed at [${column}, ${row}]`);
    streamDeck.logger.info('Current board:', JSON.stringify(this.board));
    
    // Check for winner
    if (this.checkWinner(column, row)) {
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
  private resetGame(): void {
    this.board = [
      [EMPTY, EMPTY, EMPTY],
      [EMPTY, EMPTY, EMPTY],
      [EMPTY, EMPTY, EMPTY],
      [EMPTY, EMPTY, EMPTY],
      [EMPTY, EMPTY, EMPTY],
    ];
    this.currentPlayer = PLAYER_ONE;
    this.gameOver = false;
    streamDeck.logger.info('Game reset');
  }

  /**
   * Save game state to action settings
   */
  private async saveGameState(action: any): Promise<GameSettings> {
    const currentSettings = await action.getSettings() || {};
    
    const settings = {
      ...currentSettings,
      gameState: this.board,
      currentPlayer: this.currentPlayer,
      gameOver: this.gameOver
    };
    
    await action.setSettings(settings);
    return settings;
  }


  /**
   * Check if the last move resulted in a win
   */
  private checkWinner(col: number, row: number): boolean {
    const player = this.board[col][row];
    
    // Check horizontal
    let count = 0;
    for (let c = 0; c < 5; c++) {
      if (this.board[c][row] === player) {
        count++;
        if (count === 3) return true;
      } else {
        count = 0;
      }
    }
    
    // Check vertical
    count = 0;
    for (let r = 0; r < 3; r++) {
      if (this.board[col][r] === player) {
        count++;
        if (count === 3) return true;
      } else {
        count = 0;
      }
    }
    
    // Check diagonal (top-left to bottom-right)
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 1; r++) {
        if (
          this.board[c][r] === player &&
          this.board[c+1][r+1] === player &&
          this.board[c+2][r+2] === player
        ) {
          return true;
        }
      }
    }
    
    // Check diagonal (bottom-left to top-right)
    for (let c = 0; c < 3; c++) {
      for (let r = 2; r > 1; r--) {
        if (
          this.board[c][r] === player &&
          this.board[c+1][r-1] === player &&
          this.board[c+2][r-2] === player
        ) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if the board is full (draw condition)
   */
  private isBoardFull(): boolean {
    for (let c = 0; c < 5; c++) {
      for (let r = 0; r < 3; r++) {
        if (this.board[c][r] === EMPTY) {
          return false;
        }
      }
    }
    return true;
  }
}
