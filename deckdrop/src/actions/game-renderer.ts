import streamDeck from "@elgato/streamdeck";

// Image paths
export const EMPTY_SLOT_IMAGE = "imgs/actions/deckdrop/empty-slot.svg";
export const YELLOW_TOKEN_IMAGE = "imgs/actions/deckdrop/yellow-token-in-slot.svg";
export const RED_TOKEN_IMAGE = "imgs/actions/deckdrop/red-token-in-slot.svg";
export const YELLOW_TOKEN_SOLO_IMAGE = "imgs/actions/deckdrop/yellow-token.svg";
export const RED_TOKEN_SOLO_IMAGE = "imgs/actions/deckdrop/red-token.svg";

// Board states
export const EMPTY = 0;
export const PLAYER_ONE = 1;
export const PLAYER_TWO = 2;

export class GameRenderer {
  private actionLookup: Map<string, any>;

  constructor(actionLookup: Map<string, any>) {
    this.actionLookup = actionLookup;
  }

  /**
   * Sets an image on a button at the specified coordinates
   * @param row Row coordinate
   * @param col Column coordinate
   * @param imagePath Path to the image
   * @returns Promise that resolves when the image is set
   */
  public async setButtonImage(row: number, col: number, imagePath: string): Promise<boolean> {
    const key = this.getCoordinateKey(row, col);
    const action = this.actionLookup.get(key);
    
    if (!action) {
      streamDeck.logger.info(`No action found for coordinates [${row}, ${col}]`);
      return false;
    }
    
    try {
      await action.setImage(imagePath);
      streamDeck.logger.info(`Set image for [${row}, ${col}] to ${imagePath}`);
      return true;
    } catch (error) {
      streamDeck.logger.error(`Failed to set image for [${row}, ${col}]:`, error);
      return false;
    }
  }

  /**
   * Make the winning tokens blink and then fill the board with winner's color
   * @param positions Array of [row, col] positions of winning tokens
   * @param player The player who won (PLAYER_ONE or PLAYER_TWO)
   */
  public async showWinner(positions: [number, number][], player: number): Promise<void> {
    const playerImage = player === PLAYER_ONE ? YELLOW_TOKEN_IMAGE : RED_TOKEN_IMAGE;
    
    // Blink 5 times
    for (let i = 0; i < 3; i++) {
      // Set to empty
      for (const [row, col] of positions) {
        await this.setButtonImage(row, col, EMPTY_SLOT_IMAGE);
      }
      
      // Wait half a second
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Set back to player token
      for (const [row, col] of positions) {
        await this.setButtonImage(row, col, playerImage);
      }
      
      // Wait half a second before next blink
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // After blinking, fill the board with winner's color in a diagonal pattern
    await this.fillBoardWithWinnerPattern(player);
    
    // Wait a moment to show the filled board
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Transition back to empty board
    await this.transitionToEmptyBoard();
  }

  /**
   * Fill the board with winner's color in a diagonal pattern
   * @param player The winning player
   */
  private async fillBoardWithWinnerPattern(player: number): Promise<void> {
    const playerImage = player === PLAYER_ONE ? YELLOW_TOKEN_SOLO_IMAGE : RED_TOKEN_SOLO_IMAGE;
    
    streamDeck.logger.info(`Starting diagonal fill animation for player ${player}`);
    
    // First, explicitly try to update the top-left cell
    const topLeftResult = await this.setButtonImage(0, 0, playerImage);
    streamDeck.logger.info(`Top-left cell update result: ${topLeftResult}`);
    
    // Continue with the diagonal pattern
    const diagonals = [
      [[0,0]], // First diagonal (top-left corner)
      [[0,1], [1,0]], // Second diagonal
      [[0,2], [1,1], [2,0]], // Third diagonal
      [[0,3], [1,2], [2,1]], // Fourth diagonal
      [[0,4], [1,3], [2,2]], // Fifth diagonal
      [[1,4], [2,3]], // Sixth diagonal
      [[2,4]] // Last diagonal (bottom-right corner)
    ]; 
    
    // Fill each diagonal with a slight delay between them
    for (const diagonal of diagonals) {
      for (const [row, col] of diagonal) {
        await this.setButtonImage(row, col, playerImage);
      }
      
      // Short delay before filling next diagonal
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Finally, verify all cells have been updated by doing a complete board fill
    streamDeck.logger.info(`Verifying all cells are filled for player ${player}`);
    const fillPromises: Promise<boolean>[] = [];
    
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        fillPromises.push(this.setButtonImage(row, col, playerImage));
      }
    }
    
    await Promise.all(fillPromises);
    streamDeck.logger.info(`Completed fill animation for player ${player}`);
  }

  /**
   * Transition back to empty board in a diagonal pattern (reverse of fill)
   */
  private async transitionToEmptyBoard(): Promise<void> {
    streamDeck.logger.info("Transitioning back to empty board");
    
    // Clear the board in a diagonal pattern (reverse of fill)
    const diagonals = [
      [[2,4]], // Start with bottom-right corner
      [[2,3], [1,4]], // Second diagonal
      [[2,2], [1,3], [0,4]], // Third diagonal
      [[2,1], [1,2], [0,3]], // Fourth diagonal
      [[2,0], [1,1], [0,2]], // Fifth diagonal
      [[1,0], [0,1]], // Sixth diagonal
      [[0,0]] // Last diagonal (top-left corner)
    ];
    
    // Clear each diagonal with a slight delay
    for (const diagonal of diagonals) {
      for (const [row, col] of diagonal) {
        await this.setButtonImage(row, col, EMPTY_SLOT_IMAGE);
      }
      
      // Short delay before clearing next diagonal
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Finally, verify all cells are cleared
    const clearPromises: Promise<boolean>[] = [];
    
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        clearPromises.push(this.setButtonImage(row, col, EMPTY_SLOT_IMAGE));
      }
    }
    
    await Promise.all(clearPromises);
    streamDeck.logger.info("Completed transition to empty board");
  }


  /**
   * Render the current board state on the Stream Deck
   * @param board The game board to render
   * @returns Promise that resolves when rendering is complete
   */
  public async renderBoard(board: number[][]): Promise<void> {
    streamDeck.logger.info('Rendering board...');
    
    // Create an array of promises for all the image setting operations
    const imagePromises: Promise<boolean>[] = [];
    
    // Iterate through each cell in the board
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        // Determine which image to show based on cell state
        let imagePath = "";
        switch (board[row][col]) {
          case EMPTY:
            imagePath = EMPTY_SLOT_IMAGE;
            break;
          case PLAYER_ONE:
            imagePath = YELLOW_TOKEN_IMAGE;
            break;
          case PLAYER_TWO:
            imagePath = RED_TOKEN_IMAGE;
            break;
        }
        
        if (imagePath) {
          // Add to our promises array instead of awaiting individually
          imagePromises.push(this.setButtonImage(row, col, imagePath));
        }
      }
    }
    
    // Wait for all image setting operations to complete
    await Promise.all(imagePromises);
    streamDeck.logger.info('Board rendering complete');
  }

  // Helper to create coordinate key
  private getCoordinateKey(row: number, col: number): string {
    return `${row},${col}`;
  }
  
  /**
   * Get the appropriate image for a cell based on its value
   * @param cellValue The value of the cell (EMPTY, PLAYER_ONE, or PLAYER_TWO)
   * @returns The path to the image for this cell
   */
  public getImageForCell(cellValue: number): string {
    switch (cellValue) {
      case EMPTY:
        return EMPTY_SLOT_IMAGE;
      case PLAYER_ONE:
        return YELLOW_TOKEN_IMAGE;
      case PLAYER_TWO:
        return RED_TOKEN_IMAGE;
      default:
        return EMPTY_SLOT_IMAGE;
    }
  }
}
