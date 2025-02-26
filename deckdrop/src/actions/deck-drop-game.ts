import streamDeck, { 
  action, 
  KeyDownEvent, 
  SingletonAction, 
  WillAppearEvent,
  DeviceInfo,
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
  // Game board (5 columns × 3 rows)
  private board: number[][] = [
    [EMPTY, EMPTY, EMPTY], // Column 0
    [EMPTY, EMPTY, EMPTY], // Column 1
    [EMPTY, EMPTY, EMPTY], // Column 2
    [EMPTY, EMPTY, EMPTY], // Column 3
    [EMPTY, EMPTY, EMPTY], // Column 4
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
     
    // Check if this is the controller button (top-left)
    if (ev.action.coordinates && 
        ev.action.coordinates.column === 0 && 
        ev.action.coordinates.row === 0) {
      
      // Mark as controller in settings
      await ev.action.setSettings({
        ...ev.payload.settings,
        isController: true
      });
      
      streamDeck.logger.info('Controller button identified');
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

    // Update this button
    if (ev.action.coordinates) {
      const col = ev.action.coordinates.column;
      const row = ev.action.coordinates.row;
      await this.updateButtonVisual(ev.action, col, row);
    }
  }

  hasAlreadySwitched: boolean = false;
  /**
   * Occurs when the action's key is pressed down
   */
  /**
   * Occurs when the action disappears from Stream Deck
   */
  override async onWillDisappear(ev: WillDisappearEvent<GameSettings>): Promise<void> {
    // Remove action from our lookup map if it has coordinates
    if (ev.action.coordinates) {
      const col = ev.action.coordinates.column;
      const row = ev.action.coordinates.row;
      const key = this.getCoordinateKey(col, row);
      this.actionLookup.delete(key);
      streamDeck.logger.info(`Removed action at coordinates [${col}, ${row}]`);
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

    ev.action.setState(1);


  //    // Then switch to your DeckDrop profile for all connected devices
  //    if (!this.hasAlreadySwitched) {
  //     streamDeck.devices.forEach(device => {
  //         streamDeck.profiles.switchToProfile(device.id, "DeckDrop");
  //         streamDeck.logger.info(`Switched to DeckDrop profile on device ${device.id}`);
  //     });
  //     this.hasAlreadySwitched = true;
  //    }

  //     // Check if this is the controller button
  // const isController = ev.payload.settings?.isController || false;

  // if (isController) {
  //   // Controller button logic - update the button below
  //   streamDeck.logger.info('Controller button pressed');
    
  //   if (ev.action.coordinates) { 
  //     const targetCol = ev.action.coordinates.column;
  //     const targetRow = ev.action.coordinates.row + 1; // Button below
      
  //     // Only proceed if target row is valid
  //     if (targetRow < 3) {
  //       // Toggle the state of the target cell
  //       this.toggleCellState(targetCol, targetRow);
        
  //       this.updateButtonVisual(ev.action, 0, 1)

  //       // Save game state and refresh
  //       await this.saveGameState(ev.action); 
  //       await this.refreshDeck(ev.action);
  //     } 
  //   }
  //   return;
  // }
    
  //   // Regular game button logic
  //   if (this.gameOver) {
  //     // Reset game if game is over
  //     this.resetGame();
  //     await this.saveGameState(ev.action);
      
  //     // Force all buttons to refresh by switching profiles
  //     await this.refreshDeck(ev.action);
  //     return;
  //   }

  //   // Get position from coordinates
  //   if (ev.action.coordinates) {
  //     const col = ev.action.coordinates.column;
      
  //     // Make move in the selected column
  //     const success = this.makeMove(col);
      
  //     if (success) {
  //       // Save updated game state
  //       await this.saveGameState(ev.action);
        
  //       // Force all buttons to refresh by switching profiles
  //       await this.refreshDeck(ev.action);
  //     }
  //   }
  }
  
  /**
   * Toggle cell state between empty and Player One
   */
  private toggleCellState(col: number, row: number): void {
    // Ensure column and row are within bounds
    if (col < 0 || col >= 5 || row < 0 || row >= 3) {
      streamDeck.logger.info(`Invalid coordinates: [${col}, ${row}]`);
      return;
    }
    
    // Toggle between empty and Player One
    this.board[col][row] = this.board[col][row] === EMPTY ? PLAYER_ONE : EMPTY;
    
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
 * Update visuals for all buttons in the game grid
 */
private async updateAllButtons(action: any): Promise<void> {
  // Get the device from the current action
  const device = action.device;
  
  // Update all buttons using our action lookup map
  const updatedActions = [];
  
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 3; row++) {
      const key = this.getCoordinateKey(col, row);
      const actionInstance = this.actionLookup.get(key);
      
      if (actionInstance) {
        await this.updateButtonVisual(actionInstance, col, row);
        updatedActions.push(key);
      }
    }
  }
  
  streamDeck.logger.info(`Found ${updatedActions.length} actions to update`);
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
   * Update the visual for a specific button
   */
  private async updateButtonVisual(action: any, column: number, row: number): Promise<void> {
    // Ensure column and row are within bounds
    if (column < 0 || column >= 5 || row < 0 || row >= 3) {
      streamDeck.logger.info(`Invalid coordinates: [${column}, ${row}]`);
      return;
    }
    
    const cell = 1;//this.board[column][row];
    
    // Set image based on cell state
    let imagePath;
    if (cell === PLAYER_ONE) {
      imagePath = 'imgs/actions/deckdrop/red_token_in_slot.svg';
    } else if (cell === PLAYER_TWO) {
      imagePath = 'imgs/actions/deckdrop/yellow_token_in_slot.svg';
    } else {
      imagePath = 'imgs/actions/deckdrop/empty_slot.svg';
    }
    
    // Add visual indicator for current player on empty slots
    if (cell === EMPTY && !this.gameOver) {
      // If this column is not full, highlight the topmost empty slot
      let isTopEmptyInColumn = false;
      
      // Find the topmost empty slot in this column
      for (let r = 0; r < 3; r++) {
        if (this.board[column][r] === EMPTY) {
          isTopEmptyInColumn = (r === row);
          break;
        }
      }
    }
    
    try {
      if (action.setImage) {
        return action.setImage(imagePath);
      }
    } catch (error) {
      streamDeck.logger.error(`Error setting image: ${error}`);
    }
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
