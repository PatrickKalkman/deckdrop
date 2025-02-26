import streamDeck from "@elgato/streamdeck";

// Image paths
export const EMPTY_SLOT_IMAGE = "imgs/actions/deckdrop/empty-slot.svg";
export const YELLOW_TOKEN_IMAGE = "imgs/actions/deckdrop/yellow-token-in-slot.svg";
export const RED_TOKEN_IMAGE = "imgs/actions/deckdrop/red-token-in-slot.svg";

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
   * Make the winning tokens blink
   * @param positions Array of [row, col] positions of winning tokens
   * @param player The player who won (PLAYER_ONE or PLAYER_TWO)
   */
  public async showWinner(positions: [number, number][], player: number): Promise<void> {
    const playerImage = player === PLAYER_ONE ? YELLOW_TOKEN_IMAGE : RED_TOKEN_IMAGE;
    
    // Blink 5 times
    for (let i = 0; i < 5; i++) {
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
  }

  /**
   * Render the current board state on the Stream Deck
   */
  public async renderBoard(board: number[][]): Promise<void> {
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
          await this.setButtonImage(row, col, imagePath);
        }
      }
    }
  }

  // Helper to create coordinate key
  private getCoordinateKey(row: number, col: number): string {
    return `${row},${col}`;
  }
}
