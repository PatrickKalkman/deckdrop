import streamDeck, { 
  action, 
  KeyDownEvent, 
  SingletonAction, 
  WillAppearEvent,
  WillDisappearEvent
} from "@elgato/streamdeck";

// Board states
const EMPTY = 0; 
const PLAYER_ONE = 1;
const PLAYER_TWO = 2;

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
      this.makeMove(column);
      this.renderBoard();
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
    if (this.checkWinner(row, column)) {
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
   * Check if the last move resulted in a win
   */
  private checkWinner(row: number, col: number): boolean {
    const player = this.board[row][col];
    
    // Check horizontal
    let count = 0;
    for (let c = 0; c < 5; c++) {
      if (this.board[row][c] === player) {
        count++;
        if (count === 3) return true;
      } else {
        count = 0;
      }
    }
    
    // Check vertical
    count = 0;
    for (let r = 0; r < 3; r++) {
      if (this.board[r][col] === player) {
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
          this.board[r][c] === player &&
          this.board[r+1][c+1] === player &&
          this.board[r+2][c+2] === player
        ) {
          return true;
        }
      }
    }
    
    // Check diagonal (bottom-left to top-right)
    for (let c = 0; c < 3; c++) {
      for (let r = 2; r > 1; r--) {
        if (
          this.board[r][c] === player &&
          this.board[r-1][c+1] === player &&
          this.board[r-2][c+2] === player
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
        if (this.board[r][c] === EMPTY) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Render the current board state on the Stream Deck
   */
  private async renderBoard(): Promise<void> {
    // Iterate through each cell in the board
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        // Get the action for this coordinate
        const key = this.getCoordinateKey(row, col);
        const action = this.actionLookup.get(key);
        
        if (action) {
          // Determine which image to show based on cell state
          let imagePath = "";
          switch (this.board[row][col]) {
            case EMPTY:
              imagePath = "imgs/actions/deckdrop/empty-slot.svg";
              break;
            case PLAYER_ONE:
              imagePath = "imgs/actions/deckdrop/yellow-token-in-slot.svg";
              break;
            case PLAYER_TWO:
              imagePath = "imgs/actions/deckdrop/red-token-in-slot.svg";
              break;
          }
          
          // Set the image for this button
          if (imagePath) {
            try {
              await action.setImage(imagePath);
              streamDeck.logger.info(`Set image for [${row}, ${col}] to ${imagePath}`);
            } catch (error) {
              streamDeck.logger.error(`Failed to set image for [${row}, ${col}]:`, error);
            }
          }
        } else {
          streamDeck.logger.info(`No action found for coordinates [${row}, ${col}]`);
        }
      }
    }
  }
}
